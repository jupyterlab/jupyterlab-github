// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PathExt, URLExt
} from '@jupyterlab/coreutils';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  Contents, ServerConnection
} from '@jupyterlab/services';

export
const GITHUB_API = 'https://api.github.com';

/**
 * Make a client-side request to the GitHub API.
 *
 * @param url - the api path for the GitHub API v3
 *   (not including the base url).
 *
 * @returns a Promise resolved with the JSON response.
 */
export
function browserApiRequest<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const method = 'GET';
    const requestUrl = URLExt.join(GITHUB_API, url);
    let xhr = new XMLHttpRequest();
    xhr.open(method, requestUrl);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.response));
      } else {
        const err: ServerConnection.IError = {
          xhr,
          settings: undefined,
          request: undefined,
          event: undefined,
          message: xhr.responseText
        };
        reject(err);
      }
    };
    xhr.onerror = () => {
      const err: ServerConnection.IError = {
        xhr,
        settings: undefined,
        request: undefined,
        event: undefined,
        message: xhr.responseText
      };
      reject(err);
    };
    xhr.send();
  });
}

/**
 * Make a request to the notebook server proxy for the
 * GitHub API.
 *
 * @param url - the api path for the GitHub API v3
 *   (not including the base url)
 *
 * @param settings - the settings for the current notebook server.
 *
 * @returns a Promise resolved with the JSON response.
 */
export
function proxiedApiRequest<T>(url: string, settings: ServerConnection.ISettings): Promise<T> {
  let request = {
    url: 'github/'+url,
    method: 'GET',
    cache: true
  };

  return ServerConnection.makeRequest(request, settings).then(response => {
    if (response.xhr.status !== 200) {
      throw ServerConnection.makeError(response);
    }
    return response.data;
  }).catch(response => {
    throw ServerConnection.makeError(response);
  });
}

/**
 * Typings representing contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/
 */
export
class GitHubContents {
  /**
   * The type of the file.
   */
  type: 'file' | 'dir' | 'submodule' | 'symlink';

  /**
   * The size of the file (in bytes).
   */
  size: number;

  /**
   * The name of the file.
   */
  name: string;

  /**
   * The path of the file in the repository.
   */
  path: string;

  /**
   * A unique sha identifier for the file.
   */
  sha: string;

  /**
   * The URL for the file in the GitHub UI.
   */
  url: string;

  /**
   * The URL for git access to the file.
   */
  git_url: string;

  /**
   * The URL for the file in the GitHub UI.
   */
  html_url: string;

  /**
   * The raw download URL for the file.
   */
  download_url: string;  

  /**
   * Unsure the purpose of these.
   */
  _links: {
    git: string;

    self: string;

    html: string;
  };
}

/**
 * Typings representing file contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/#response-if-content-is-a-file
 */
export
class GitHubFileContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'file';

  /**
   * Encoding of the content. All files are base64 encoded.
   */
  encoding: 'base64';

  /**
   * The actual base64 encoded contents.
   */
  content?: string;
}

/**
 * Typings representing a directory from the GitHub API v3.
 */
export
class GitHubDirectoryContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'dir';
}

/**
 * Typings representing a blob from the GitHub API v3.
 * Cf: https://developer.github.com/v3/git/blobs/#response
 */
export
class GitHubBlob {
  /**
   * Add undefined attribute so that it may be assigned to
   * a GitHubFileContents in gitHubToJupyter below.
   */
  type: undefined;

  /**
   * The base64-encoded contents of the file.
   */
  content: string;

  /**
   * The encoding of the contents. Always base64.
   */
  encoding: 'base64';

  /**
   * The URL for the blob.
   */
  url: string;

  /**
   * The unique sha for the blob.
   */
  sha: string;

  /**
   * The size of the blob, in bytes.
   */
  size: number;
}


/**
 * Typings representing symlink contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/#response-if-content-is-a-symlink
 */
export
class GitHubSymlinkContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'symlink';
}

/**
 * Typings representing submodule contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/#response-if-content-is-a-submodule
 */
export
class GitHubSubmoduleContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'submodule';
}

/**
 * Typings representing directory contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/#response-if-content-is-a-directory
 */
export
type GitHubDirectoryListing = GitHubContents[];


/**
 * Given a JSON GitHubContents object returned by the GitHub API v3,
 * convert it to the Jupyter Contents.IModel.
 *
 * @param path - the path to the contents model in the repository.
 *
 * @param contents - the GitHubContents object, or a GitHubBlob.
 *
 * @param fileTypeForPath - a function that, given a path, returns
 *   a DocumentRegistry.IFileType, used by JupyterLab to identify different
 *   openers, icons, etc.
 *
 * @returns a Contents.IModel object.
 */
export
function gitHubToJupyter(path: string, contents: GitHubContents | GitHubBlob, fileTypeForPath: (path: string) => DocumentRegistry.IFileType): Contents.IModel {
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
        return gitHubToJupyter(c.path, c, fileTypeForPath);
      })
    } as Contents.IModel;
  } else if (contents.type === 'file' || contents.type === undefined) {
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
