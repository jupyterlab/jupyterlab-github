// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import {
  GitHubDrive
} from './contents';

/**
 * Google Drive filebrowser plugin state namespace.
 */
const NAMESPACE = 'github-filebrowser';

/**
 * The JupyterLab plugin for the GitHub Filebrowser.
 */
const fileBrowserPlugin: JupyterLabPlugin<void> = {
  id: '@jupyterlab/github:drive',
  requires: [IDocumentManager, IFileBrowserFactory, ILayoutRestorer],
  activate: activateFileBrowser,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateFileBrowser(app: JupyterLab, manager: IDocumentManager, factory: IFileBrowserFactory, restorer: ILayoutRestorer): void {
  const { commands } = app;

  // Add the Google Drive backend to the contents manager.
  const drive = new GitHubDrive(app.docRegistry);
  manager.services.contents.addDrive(drive);

  const browser = factory.createFileBrowser(NAMESPACE, {
    commands,
    driveName: drive.name
  });
  // Add the file browser widget to the application restorer.
  restorer.add(browser, NAMESPACE);
  app.shell.addToLeftArea(browser, { rank: 102 });

  return;
}

export default fileBrowserPlugin;
