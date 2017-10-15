// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Widget
} from '@phosphor/widgets';

import {
  FileBrowser
} from '@jupyterlab/filebrowser';

import {
  GitHubDrive
} from './contents';

/**
 * Widget for hosting the Google Drive filebrowser.
 */
export
class GitHubFileBrowser extends Widget {
  constructor(browser: FileBrowser, drive: GitHubDrive) {
    super();
    this.addClass('jp-GitHub');
    this._browser = browser;
    this._browser.toolbar
    this._drive = drive;
    this.node.appendChild(this._browser.node);
  }

  private _browser: FileBrowser;
  private _drive: GitHubDrive;
}
