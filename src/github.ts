// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ServerConnection } from '@jupyterlab/services';

/**
 * Make a client-side request to the GitHub API.
 *
 * @param url - the api path for the GitHub API v3
 *   (not including the base url).
 *
 * @returns a Promise resolved with the JSON response.
 */
export function browserApiRequest<T>(url: string): Promise<T> {
  return window.fetch(url).then(response => {
    if (response.status !== 200) {
      return response.json().then(data => {
        throw new ServerConnection.ResponseError(response, data.message);
      });
    }
    return response.json();
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
export function proxiedApiRequest<T>(
  url: string,
  settings: ServerConnection.ISettings
): Promise<T> {
  return ServerConnection.makeRequest(url, {}, settings).then(response => {
    if (response.status !== 200) {
      return response.json().then(data => {
        throw new ServerConnection.ResponseError(response, data.message);
      });
    }
    return response.json();
  });
}

/**
 * Typings representing contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/
 */
export interface GitHubContents {
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
   * The URL for the file in the GitHub API.
   */
  url: string;

  /**
   * The URL for git access to the file.
   */
  // tslint:disable-next-line
  git_url: string;

  /**
   * The URL for the file in the GitHub UI.
   */
  // tslint:disable-next-line
  html_url: string;

  /**
   * The raw download URL for the file.
   */
  // tslint:disable-next-line
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
export interface GitHubFileContents extends GitHubContents {
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
export interface GitHubDirectoryContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'dir';
}

/**
 * Typings representing a blob from the GitHub API v3.
 * Cf: https://developer.github.com/v3/git/blobs/#response
 */
export interface GitHubBlob {
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
export interface GitHubSymlinkContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'symlink';
}

/**
 * Typings representing submodule contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/#response-if-content-is-a-submodule
 */
export interface GitHubSubmoduleContents extends GitHubContents {
  /**
   * The type of the contents.
   */
  type: 'submodule';
}

/**
 * Typings representing directory contents from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/contents/#response-if-content-is-a-directory
 */
export type GitHubDirectoryListing = GitHubContents[];

/**
 * Typings representing repositories from the GitHub API v3.
 * Cf: https://developer.github.com/v3/repos/#list-organization-repositories
 *
 * #### Notes
 *   This is incomplete.
 */
export interface GitHubRepo {
  /**
   * ID for the repository.
   */
  id: number;

  /**
   * The owner of the repository.
   */
  owner: any;

  /**
   * The name of the repository.
   */
  name: string;

  /**
   * The full name of the repository, including the owner name.
   */
  // tslint:disable-next-line
  full_name: string;

  /**
   * A description of the repository.
   */
  description: string;

  /**
   * Whether the repository is private.
   */
  private: boolean;

  /**
   * Whether the repository is a fork.
   */
  fork: boolean;

  /**
   * The URL for the repository in the GitHub API.
   */
  url: string;

  /**
   * The URL for the repository in the GitHub UI.
   */
  // tslint:disable-next-line
  html_url: string;
}
