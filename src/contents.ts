// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Signal, ISignal
} from '@phosphor/signaling';

import {
  PathExt, URLExt
} from '@jupyterlab/coreutils';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  Contents, ServerConnection,
} from '@jupyterlab/services';

import {
  browserApiRequest, proxiedApiRequest, GITHUB_API, GitHubRepo,
  GitHubContents, GitHubBlob, GitHubFileContents, GitHubDirectoryListing
} from './github';


/**
 * A Contents.IDrive implementation that serves as a read-only
 * view onto GitHub repositories.
 */
export
class GitHubDrive implements Contents.IDrive {
  /**
   * Construct a new drive object.
   *
   * @param options - The options used to initialize the object.
   */
  constructor(registry: DocumentRegistry) {
    this._serverSettings = ServerConnection.makeSettings();
    this._fileTypeForPath = (path: string) => {
      const types = registry.getFileTypesForPath(path);
      return types.length === 0 ?
             registry.getFileType('text')! :
             types[0];
    };

    // Test an api request to the notebook server
    // to see if the server proxy is installed.
    // If so, use that. If not, warn the user and
    // use the client-side implementation.
    proxiedApiRequest<any>('', this._serverSettings).then(() => {
      this._useProxy = true;
    }).catch(() => {
      console.warn('The JupyterLab Github server extension appears '+
                   'to be missing. If you do not install it with application '+
                   'credentials, you are likely to be rate limited by GitHub '+
                   'very quickly');
      this._useProxy = false;
    });
  }

  /**
   * The name of the drive.
   */
  get name(): 'GitHub' {
    return 'GitHub';
  }

  readonly serverSettings: ServerConnection.ISettings;

  /**
   * The name of the current organization for the drive.
   */
  get org(): string {
    return this._org;
  }
  set org(org: string) {
    if (org === this._org) {
      return;
    }
    this._org = org;
  }

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

  /**h
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
   * Get the base url of the manager.
   */
  get baseURL(): string {
    return GITHUB_API;
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
  get(path: string, options?: Contents.IFetchOptions): Promise<Contents.IModel> {
    // If the org has not been set, return an empty directory
    // placeholder.
    if (this._org === '') {
      return Promise.resolve(Private.DummyDirectory);
    }

    // If the org has been set and the path is empty, list
    // the repositories for the org.
    if (this._org !== '' && path === '') {
      const apiPath = URLExt.join('orgs', this._org, 'repos');
      return this._apiRequest<GitHubRepo[]>(apiPath).then(repos => {
        return Private.reposToDirectory(repos);
      });
    }

    // Otherwise identify the repository and get the contents of the
    // appropriate resource.
    const repo = path.split('/')[0];
    const repoPath = URLExt.join(...path.split('/').slice(1));
    const apiPath = URLExt.join('repos', this._org, repo, 'contents', repoPath);
    return this._apiRequest<GitHubContents>(apiPath).then(contents => {
      return Private.gitHubContentsToJupyterContents(
        path, contents, this._fileTypeForPath);
    }).catch(response => {
      if(response.xhr.status === 404) {
        console.warn('GitHub: cannot find org/repo. '+
                     'Perhaps you misspelled something?');
        return Private.DummyDirectory;
      } else if (response.xhr.status === 403 &&
                 response.xhr.responseText.indexOf('rate limit') !== -1) {
        console.error(response.message);
        return Promise.reject(response);
      } else if (response.xhr.status === 403 &&
                 response.xhr.responseText.indexOf('blob') !== -1) {
        return this._getBlob(path);
      } else {
        console.error(response.message);
        return Promise.reject(response);
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
    return Promise.reject('Repository is read only');
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
  save(path: string, options: Partial<Contents.IModel>): Promise<Contents.IModel> {
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
    const repo = path.split('/')[0];
    const repoPath = URLExt.join(...path.split('/').slice(1));
    const dirname = PathExt.dirname(repoPath);
    const dirApiPath = URLExt.join('repos', this._org, repo, 'contents', dirname);
    return this._apiRequest<GitHubDirectoryListing>(dirApiPath).then(dirContents => {
      for (let item of dirContents) {
        if (item.path === repoPath) {
          blobData = item as GitHubFileContents;
          return item.sha;
        }
      }
      throw Error('Cannot find sha for blob');
    }).then(sha => {
      //Once we have the sha, form the api url and make the request.
      const blobApiPath = URLExt.join(
        'repos', this._org, repo, 'git', 'blobs', sha);
      return this._apiRequest<GitHubBlob>(blobApiPath);
    }).then(blob => {
      //Convert the data to a Contents.IModel.
      blobData.content = blob.content;
      return Private.gitHubContentsToJupyterContents(
        path, blobData, this._fileTypeForPath);
    });
  }

  /**
   * Determine whether to make the call via the
   * notebook server proxy or not.
   */
  private _apiRequest<T>(apiPath: string): Promise<T> {
    if (this._useProxy === true) {
      return proxiedApiRequest<T>(apiPath, this._serverSettings);
    } else {
      return browserApiRequest(apiPath);
    }
  }

  private _serverSettings: ServerConnection.ISettings;
  private _useProxy = false;
  private _fileTypeForPath: (path: string) => DocumentRegistry.IFileType;
  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
  private _org = '';
}

/**
 * Private namespace for utility functions.
 */
namespace Private {
  export
  const DummyDirectory: Contents.IModel = {
    type: 'directory',
    path: '',
    name: '',
    format: 'json',
    content: [],
    created: '',
    writable: false,
    last_modified: '',
    mimetype: null,
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
  export
  function gitHubContentsToJupyterContents(path: string, contents: GitHubContents | GitHubContents[], fileTypeForPath: (path: string) => DocumentRegistry.IFileType): Contents.IModel {
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
        mimetype: null,
        content: contents.map( c => {
          return gitHubContentsToJupyterContents(
            PathExt.join(path, c.name), c, fileTypeForPath);
        })
      } as Contents.IModel;
    } else if (contents.type === 'file') {
      // If it is a file or blob, convert to a file
      const fileType = fileTypeForPath(path);
      const fileContents = (contents as GitHubFileContents).content;
      let content: any;
      switch (fileType.fileFormat) {
        case 'text':
          content = fileContents ? atob(fileContents) : null;
          break;
        case 'base64':
          content = fileContents || null;
          break;
        case 'json':
          content = fileContents ? JSON.parse(atob(fileContents)) : null;
          break;
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
      }
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
        mimetype: null,
        content: null
      }
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
  export
  function reposToDirectory(repos: GitHubRepo[]): Contents.IModel {
    // If it is a directory, convert to that.
    let content: Contents.IModel[] = repos.map( repo => {
      return {
        name: repo.name,
        path: repo.name,
        format: 'json',
        type: 'directory',
        created: '',
        writable: false,
        last_modified: '',
        mimetype: null,
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
      mimetype: null,
      content
    };
  }
}
