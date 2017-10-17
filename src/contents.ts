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
  proxiedApiRequest, GITHUB_API, gitHubToJupyter,
  GitHubBlob, GitHubFileContents, GitHubDirectoryListing
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
    this._fileTypeForPath = (path: string) => {
      const types = registry.getFileTypesForPath(path);
      return types.length === 0 ?
             registry.getFileType('text')! :
             types[0];
    };
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
    this.repo = '';
  }

  /**
   * The name of the current repository for the drive.
   */
  get repo(): string {
    return this._repo;
  }
  set repo(repo: string) {
    if (repo === this._repo) {
      return;
    }
    this._repo = repo;
    this.branch = '';
  }

  /**
   * The name of the current branch for the drive.
   */
  get branch(): string {
    return this._branch;
  }
  set branch(branch: string) {
    if (branch === this._branch) {
      return;
    }
    this._branch = branch;
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
    if (this._org === '' || this._repo === '') {
      return Promise.resolve(Private.DummyDirectory);
    }
    const apiPath = URLExt.join('repos', this._org, this._repo, 'contents', path);
    return proxiedApiRequest<any>(apiPath).then(contents => {
      return gitHubToJupyter(path, contents, this._fileTypeForPath);
    }).catch(response => {
      if(response.xhr.status === 404) {
        console.warn('GitHub: cannot find org/repo. '+
                     'Perhaps you misspelled something?');
        return Private.DummyDirectory;
      }
      if (response.xhr.status === 403) {
        return this._getBlob(path);
      } else {
        throw response;
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

  private _getBlob(path: string): Promise<Contents.IModel> {
    let blobData: GitHubFileContents;
    const dirname = PathExt.dirname(path);
    const dirApiPath = URLExt.join('repos', this._org, this._repo, 'contents', dirname);
    return proxiedApiRequest<GitHubDirectoryListing>(dirApiPath).then(dirContents => {
      for (let item of dirContents) {
        if (item.path === path) {
          blobData = item as GitHubFileContents;
          return item.sha;
        }
      }
      throw Error('Cannot find sha for blob');
    }).then(sha => {
      const blobApiPath = URLExt.join(
        'repos', this._org, this._repo, 'git', 'blobs', sha);
      return proxiedApiRequest<GitHubBlob>(blobApiPath);
    }).then(blob => {
      blobData.content = blob.content;
      return gitHubToJupyter(path, blobData, this._fileTypeForPath);
    });
  }

  private _fileTypeForPath: (path: string) => DocumentRegistry.IFileType;
  private _isDisposed = false;
  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);
  private _org = '';
  private _repo = '';
  private _branch = '';
}

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
}
