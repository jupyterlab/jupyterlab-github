// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  FileBrowser
} from '@jupyterlab/filebrowser';

import {
  GitHubDrive
} from './contents';

/**
 * Widget for hosting the GitHub filebrowser.
 */
export
class GitHubFileBrowser extends Widget {
  constructor(browser: FileBrowser, drive: GitHubDrive) {
    super();
    this.addClass('jp-GitHubBrowser');
    this.layout = new PanelLayout();
    (this.layout as PanelLayout).addWidget(browser);
    this._browser = browser;
    this._drive = drive;
    drive.org = 'ian-r-rose';
    drive.repo = 'jupyterlab-github';
  }

  private _browser: FileBrowser;
  private _drive: GitHubDrive;
}
