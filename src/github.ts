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

export
class GitHubContents {
  type: 'file' | 'dir' | 'submodule' | 'symlink';

  size: number;

  name: string;

  path: string;

  sha: string;

  url: string;

  git_url: string;

  html_url: string;

  download_url: string;  

  _links: {
    git: string;

    self: string;

    html: string;
  };
}

export
class GitHubFileContents extends GitHubContents {
  type: 'file';

  encoding: 'base64';

  content?: string;
}

export
class GitHubDirectoryContents extends GitHubContents {
  type: 'dir';
}

export
class GitHubBlob {
  type: undefined;

  content: string;

  encoding: 'base64';

  url: string;

  sha: string;

  size: number;
}


export
class GitHubSymLinkContents extends GitHubContents {
  type: 'symlink';
}

export
type GitHubDirectoryListing = GitHubContents[];

export
function gitHubToJupyter(path: string, contents: GitHubContents | GitHubBlob, fileTypeForPath: (path: string) => DocumentRegistry.IFileType): Contents.IModel {
  if (Array.isArray(contents)) {
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
      mimetype: null,
      content
    }
  } else if (contents.type === 'dir') {
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
