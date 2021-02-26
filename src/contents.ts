// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Signal, ISignal } from '@lumino/signaling';

import { PathExt, URLExt } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ObservableValue } from '@jupyterlab/observables';

import { Contents, ServerConnection } from '@jupyterlab/services';

import {
  browserApiRequest,
  proxiedApiRequest,
  GitHubRepo,
  GitHubContents,
  GitHubBlob,
  GitHubFileContents,
  GitHubDirectoryListing
} from './github';

import * as base64js from 'base64-js';

export const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
export const DEFAULT_GITHUB_BASE_URL = 'https://github.com';

/**
 * A Contents.IDrive implementation that serves as a read-only
 * view onto GitHub repositories.
 */
export class GitHubDrive implements Contents.IDrive {
  /**
   * Construct a new drive object.
   *
   * @param options - The options used to initialize the object.
   */
  constructor(registry: DocumentRegistry) {
    this._serverSettings = ServerConnection.makeSettings();
    this._fileTypeForPath = (path: string) => {
      const types = registry.getFileTypesForPath(path);
      return types.length === 0 ? registry.getFileType('text')! : types[0];
    };

    this.baseUrl = DEFAULT_GITHUB_BASE_URL;

    // Test an api request to the notebook server
    // to see if the server proxy is installed.
    // If so, use that. If not, warn the user and
    // use the client-side implementation.
    this._useProxy = new Promise<boolean>(resolve => {
      const requestUrl = URLExt.join(this._serverSettings.baseUrl, 'github');
      proxiedApiRequest<any>(requestUrl, this._serverSettings)
        .then(() => {
          resolve(true);
        })
        .catch(() => {
          console.warn(
            'The JupyterLab GitHub server extension appears ' +
              'to be missing. If you do not install it with application ' +
              'credentials, you are likely to be rate limited by GitHub ' +
              'very quickly'
          );
          resolve(false);
        });
    });

    // Initialize the rate-limited observable.
    this.rateLimitedState = new ObservableValue(false);
  }

  /**
   * The name of the drive.
   */
  get name(): 'GitHub' {
    return 'GitHub';
  }

  /**
   * State for whether the user is valid.
   */
  get validUser(): boolean {
    return this._validUser;
  }

  /**
   * Settings for the notebook server.
   */
  get serverSettings(): ServerConnection.ISettings {
    return this._serverSettings;
  }

  /**
   * State for whether the drive is being rate limited by GitHub.
   */
  readonly rateLimitedState: ObservableValue;

  /**
   * A signal emitted when a file operation takes place.
   */
  get fileChanged(): ISignal<this, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  /**
   * Test whether the manager has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the manager.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }

  /**
   * The GitHub base URL
   */
  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * The GitHub base URL is set by the settingsRegistry change hook
   */
  set baseUrl(url: string) {
    this._baseUrl = url;
  }

  /**
   * The GitHub access token
   */
  get accessToken(): string | null | undefined {
    return this._accessToken;
  }

  /**
   * The GitHub access token is set by the settingsRegistry change hook
   */
  set accessToken(token: string | null | undefined) {
    this._accessToken = token;
  }

  /**
   * Get a file or directory.
   *
   * @param path: The path to the file.
   *
   * @param options: The options used to fetch the file.
   *
   * @returns A promise which resolves with the file content.
   */
  get(
    path: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    const resource = parsePath(path);
    // If the org has not been set, return an empty directory
    // placeholder.
    if (resource.user === '') {
      this._validUser = false;
      return Promise.resolve(Private.dummyDirectory);
    }

    // If the org has been set and the path is empty, list
    // the repositories for the org.
    if (resource.user && !resource.repository) {
      return this._listRepos(resource.user);
    }

    // Otherwise identify the repository and get the contents of the
    // appropriate resource.
    const apiPath = URLExt.encodeParts(
      URLExt.join(
        'repos',
        resource.user,
        resource.repository,
        'contents',
        resource.path
      )
    );
    return this._apiRequest<GitHubContents>(apiPath)
      .then(contents => {
        // Set the states
        this._validUser = true;
        if (this.rateLimitedState.get() !== false) {
          this.rateLimitedState.set(false);
        }

        return Private.gitHubContentsToJupyterContents(
          path,
          contents,
          this._fileTypeForPath
        );
      })
      .catch((err: ServerConnection.ResponseError) => {
        if (err.response.status === 404) {
          console.warn(
            'GitHub: cannot find org/repo. ' +
              'Perhaps you misspelled something?'
          );
          this._validUser = false;
          return Private.dummyDirectory;
        } else if (
          err.response.status === 403 &&
          err.message.indexOf('rate limit') !== -1
        ) {
          if (this.rateLimitedState.get() !== true) {
            this.rateLimitedState.set(true);
          }
          console.error(err.message);
          return Promise.reject(err);
        } else if (
          err.response.status === 403 &&
          err.message.indexOf('blob') !== -1
        ) {
          // Set the states
          this._validUser = true;
          if (this.rateLimitedState.get() !== false) {
            this.rateLimitedState.set(false);
          }
          return this._getBlob(path);
        } else {
          console.error(err.message);
          return Promise.reject(err);
        }
      });
  }

  /**
   * Get an encoded download url given a file path.
   *
   * @param path - An absolute POSIX file path on the server.
   *
   * #### Notes
   * It is expected that the path contains no relative paths,
   * use [[ContentsManager.getAbsolutePath]] to get an absolute
   * path if necessary.
   */
  getDownloadUrl(path: string): Promise<string> {
    // Parse the path into user/repo/path
    const resource = parsePath(path);
    // Error if the user has not been set
    if (!resource.user) {
      return Promise.reject('GitHub: no active organization');
    }

    // Error if there is no path.
    if (!resource.path) {
      return Promise.reject('GitHub: No file selected');
    }

    // Otherwise identify the repository and get the url of the
    // appropriate resource.
    const dirname = PathExt.dirname(resource.path);
    const dirApiPath = URLExt.encodeParts(
      URLExt.join(
        'repos',
        resource.user,
        resource.repository,
        'contents',
        dirname
      )
    );
    return this._apiRequest<GitHubDirectoryListing>(dirApiPath).then(
      dirContents => {
        for (let item of dirContents) {
          if (item.path === resource.path) {
            return item.download_url;
          }
        }
        throw Private.makeError(404, `Cannot find file at ${resource.path}`);
      }
    );
  }

  /**
   * Create a new untitled file or directory in the specified directory path.
   *
   * @param options: The options used to create the file.
   *
   * @returns A promise which resolves with the created file content when the
   *    file is created.
   */
  newUntitled(options: Contents.ICreateOptions = {}): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Delete a file.
   *
   * @param path - The path to the file.
   *
   * @returns A promise which resolves when the file is deleted.
   */
  delete(path: string): Promise<void> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Rename a file or directory.
   *
   * @param path - The original file path.
   *
   * @param newPath - The new file path.
   *
   * @returns A promise which resolves with the new file contents model when
   *   the file is renamed.
   */
  rename(path: string, newPath: string): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Save a file.
   *
   * @param path - The desired file path.
   *
   * @param options - Optional overrides to the model.
   *
   * @returns A promise which resolves with the file content model when the
   *   file is saved.
   */
  save(
    path: string,
    options: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Copy a file into a given directory.
   *
   * @param path - The original file path.
   *
   * @param toDir - The destination directory path.
   *
   * @returns A promise which resolves with the new contents model when the
   *  file is copied.
   */
  copy(fromFile: string, toDir: string): Promise<Contents.IModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Create a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with the new checkpoint model when the
   *   checkpoint is created.
   */
  createCheckpoint(path: string): Promise<Contents.ICheckpointModel> {
    return Promise.reject('Repository is read only');
  }

  /**
   * List available checkpoints for a file.
   *
   * @param path - The path of the file.
   *
   * @returns A promise which resolves with a list of checkpoint models for
   *    the file.
   */
  listCheckpoints(path: string): Promise<Contents.ICheckpointModel[]> {
    return Promise.resolve([]);
  }

  /**
   * Restore a file to a known checkpoint state.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to restore.
   *
   * @returns A promise which resolves when the checkpoint is restored.
   */
  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.reject('Repository is read only');
  }

  /**
   * Delete a checkpoint for a file.
   *
   * @param path - The path of the file.
   *
   * @param checkpointID - The id of the checkpoint to delete.
   *
   * @returns A promise which resolves when the checkpoint is deleted.
   */
  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    return Promise.reject('Read only');
  }

  /**
   * If a file is too large (> 1Mb), we need to access it over the
   * GitHub Git Data API.
   */
  private _getBlob(path: string): Promise<Contents.IModel> {
    let blobData: GitHubFileContents;
    // Get the contents of the parent directory so that we can
    // get the sha of the blob.
    const resource = parsePath(path);
    const dirname = PathExt.dirname(resource.path);
    const dirApiPath = URLExt.encodeParts(
      URLExt.join(
        'repos',
        resource.user,
        resource.repository,
        'contents',
        dirname
      )
    );
    return this._apiRequest<GitHubDirectoryListing>(dirApiPath)
      .then(dirContents => {
        for (let item of dirContents) {
          if (item.path === resource.path) {
            blobData = item as GitHubFileContents;
            return item.sha;
          }
        }
        throw Error('Cannot find sha for blob');
      })
      .then(sha => {
        // Once we have the sha, form the api url and make the request.
        const blobApiPath = URLExt.encodeParts(
          URLExt.join(
            'repos',
            resource.user,
            resource.repository,
            'git',
            'blobs',
            sha
          )
        );
        return this._apiRequest<GitHubBlob>(blobApiPath);
      })
      .then(blob => {
        // Convert the data to a Contents.IModel.
        blobData.content = blob.content;
        return Private.gitHubContentsToJupyterContents(
          path,
          blobData,
          this._fileTypeForPath
        );
      });
  }

  /**
   * List the repositories for the currently active user.
   */
  private _listRepos(user: string): Promise<Contents.IModel> {
    // First, check if the `user` string is actually an org.
    // If will return with an error if not, and we can try
    // the user path.
    const apiPath = URLExt.encodeParts(URLExt.join('orgs', user, 'repos'));
    return this._apiRequest<GitHubRepo[]>(apiPath)
      .catch(err => {
        // If we can't find the org, it may be a user.
        if (err.response.status === 404) {
          // Check if it is the authenticated user.
          return this._apiRequest<any>('user')
            .then(currentUser => {
              let reposPath: string;
              // If we are looking at the currently authenticated user,
              // get all the repositories they own, which includes private ones.
              if (currentUser.login === user) {
                reposPath = 'user/repos?type=owner';
              } else {
                reposPath = URLExt.encodeParts(
                  URLExt.join('users', user, 'repos')
                );
              }
              return this._apiRequest<GitHubRepo[]>(reposPath);
            })
            .catch(err => {
              // If there is no authenticated user, return the public
              // users api path.
              if (err.response.status === 401) {
                const reposPath = URLExt.encodeParts(
                  URLExt.join('users', user, 'repos')
                );
                return this._apiRequest<GitHubRepo[]>(reposPath);
              }
              throw err;
            });
        }
        throw err;
      })
      .then(repos => {
        // Set the states
        this._validUser = true;
        if (this.rateLimitedState.get() !== false) {
          this.rateLimitedState.set(false);
        }
        return Private.reposToDirectory(repos);
      })
      .catch(err => {
        if (
          err.response.status === 403 &&
          err.message.indexOf('rate limit') !== -1
        ) {
          if (this.rateLimitedState.get() !== true) {
            this.rateLimitedState.set(true);
          }
        } else {
          console.error(err.message);
          console.warn(
            'GitHub: cannot find user. ' + 'Perhaps you misspelled something?'
          );
          this._validUser = false;
        }
        return Private.dummyDirectory;
      });
  }

  /**
   * Determine whether to make the call via the
   * notebook server proxy or not.
   */
  private _apiRequest<T>(apiPath: string): Promise<T> {
    return this._useProxy.then(result => {
      let parts = apiPath.split('?');
      let path = parts[0];
      let query = (parts[1] || '').split('&');
      let params: { [key: string]: string } = {};
      for (const param of query) {
        if (param) {
          let [key, value] = param.split('=');
          params[key] = value;
        }
      }
      let requestUrl: string;
      if (result === true) {
        requestUrl = URLExt.join(this._serverSettings.baseUrl, 'github');
        // add the access token if defined
        if (this.accessToken) {
          params['access_token'] = this.accessToken;
        }
      } else {
        requestUrl = DEFAULT_GITHUB_API_URL;
      }
      if (path) {
        requestUrl = URLExt.join(requestUrl, path);
      }
      let newQuery = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
      requestUrl += '?' + newQuery;
      if (result === true) {
        return proxiedApiRequest<T>(requestUrl, this._serverSettings);
      } else {
        return browserApiRequest<T>(requestUrl);
      }
    });
  }

  private _baseUrl: string = 'github';
  private _accessToken: string | null | undefined;
  private _validUser = false;
  private _serverSettings: ServerConnection.ISettings;
  private _useProxy: Promise<boolean>;
  private _fileTypeForPath: (path: string) => DocumentRegistry.IFileType;
  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
}

/**
 * Specification for a file in a repository.
 */
export interface IGitHubResource {
  /**
   * The user or organization for the resource.
   */
  readonly user: string;

  /**
   * The repository in the organization/user.
   */
  readonly repository: string;

  /**
   * The path in the repository to the resource.
   */
  readonly path: string;
}

/**
 * Parse a path into a IGitHubResource.
 */
export function parsePath(path: string): IGitHubResource {
  const parts = path.split('/');
  const user = parts.length > 0 ? parts[0] : '';
  const repository = parts.length > 1 ? parts[1] : '';
  const repoPath = parts.length > 2 ? URLExt.join(...parts.slice(2)) : '';
  return { user, repository, path: repoPath };
}

/**
 * Private namespace for utility functions.
 */
namespace Private {
  /**
   * A dummy contents model indicating an invalid or
   * nonexistent repository.
   */
  export const dummyDirectory: Contents.IModel = {
    type: 'directory',
    path: '',
    name: '',
    format: 'json',
    content: [],
    created: '',
    writable: false,
    last_modified: '',
    mimetype: ''
  };

  /**
   * Given a JSON GitHubContents object returned by the GitHub API v3,
   * convert it to the Jupyter Contents.IModel.
   *
   * @param path - the path to the contents model in the repository.
   *
   * @param contents - the GitHubContents object.
   *
   * @param fileTypeForPath - a function that, given a path, returns
   *   a DocumentRegistry.IFileType, used by JupyterLab to identify different
   *   openers, icons, etc.
   *
   * @returns a Contents.IModel object.
   */
  export function gitHubContentsToJupyterContents(
    path: string,
    contents: GitHubContents | GitHubContents[],
    fileTypeForPath: (path: string) => DocumentRegistry.IFileType
  ): Contents.IModel {
    if (Array.isArray(contents)) {
      // If we have an array, it is a directory of GitHubContents.
      // Iterate over that and convert all of the items in the array/
      return {
        name: PathExt.basename(path),
        path: path,
        format: 'json',
        type: 'directory',
        writable: false,
        created: '',
        last_modified: '',
        mimetype: '',
        content: contents.map(c => {
          return gitHubContentsToJupyterContents(
            PathExt.join(path, c.name),
            c,
            fileTypeForPath
          );
        })
      } as Contents.IModel;
    } else if (contents.type === 'file' || contents.type === 'symlink') {
      // If it is a file or blob, convert to a file
      const fileType = fileTypeForPath(path);
      const fileContents = (contents as GitHubFileContents).content;
      let content: any;
      switch (fileType.fileFormat) {
        case 'text':
          content =
            fileContents !== undefined
              ? Private.b64DecodeUTF8(fileContents)
              : null;
          break;
        case 'base64':
          content = fileContents !== undefined ? fileContents : null;
          break;
        case 'json':
          content =
            fileContents !== undefined
              ? JSON.parse(Private.b64DecodeUTF8(fileContents))
              : null;
          break;
        default:
          throw new Error(`Unexpected file format: ${fileType.fileFormat}`);
      }
      return {
        name: PathExt.basename(path),
        path: path,
        format: fileType.fileFormat,
        type: 'file',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: fileType.mimeTypes[0],
        content
      };
    } else if (contents.type === 'dir') {
      // If it is a directory, convert to that.
      return {
        name: PathExt.basename(path),
        path: path,
        format: 'json',
        type: 'directory',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: '',
        content: null
      };
    } else if (contents.type === 'submodule') {
      // If it is a submodule, throw an error, since we cannot
      // GET submodules at the moment. NOTE: due to a bug in the GithHub
      // API, the `type` for submodules in a directory listing is incorrectly
      // reported as `file`: https://github.com/github/developer.github.com/commit/1b329b04cece9f3087faa7b1e0382317a9b93490
      // This means submodules will show up in the listing, but we still should not
      // open them.
      throw makeError(
        400,
        `Cannot open "${contents.name}" because it is a submodule`
      );
    } else {
      throw makeError(
        500,
        `"${contents.name}" has and unexpected type: ${contents.type}`
      );
    }
  }

  /**
   * Given an array of JSON GitHubRepo objects returned by the GitHub API v3,
   * convert it to the Jupyter Contents.IModel conforming to a directory of
   * those repositories.
   *
   * @param repo - the GitHubRepo object.
   *
   * @returns a Contents.IModel object.
   */
  export function reposToDirectory(repos: GitHubRepo[]): Contents.IModel {
    // If it is a directory, convert to that.
    let content: Contents.IModel[] = repos.map(repo => {
      return {
        name: repo.name,
        path: repo.full_name,
        format: 'json',
        type: 'directory',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: '',
        content: null
      } as Contents.IModel;
    });

    return {
      name: '',
      path: '',
      format: 'json',
      type: 'directory',
      created: '',
      last_modified: '',
      writable: false,
      mimetype: '',
      content
    };
  }

  /**
   * Wrap an API error in a hacked-together error object
   * masquerading as an `ServerConnection.ResponseError`.
   */
  export function makeError(
    code: number,
    message: string
  ): ServerConnection.ResponseError {
    const response = new Response(message, {
      status: code,
      statusText: message
    });
    return new ServerConnection.ResponseError(response, message);
  }

  /**
   * Decoder from bytes to UTF-8.
   */
  const decoder = new TextDecoder('utf8');

  /**
   * Decode a base-64 encoded string into unicode.
   *
   * See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#Solution_2_%E2%80%93_rewrite_the_DOMs_atob()_and_btoa()_using_JavaScript's_TypedArrays_and_UTF-8
   */
  export function b64DecodeUTF8(str: string): string {
    const bytes = base64js.toByteArray(str.replace(/\n/g, ''));
    return decoder.decode(bytes);
  }
}
