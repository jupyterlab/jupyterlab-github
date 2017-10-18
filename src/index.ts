// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  IStateDB
} from '@jupyterlab/coreutils';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import {
  GitHubDrive
} from './contents';

import {
  GitHubFileBrowser
} from './browser';

import '../style/index.css';

/**
 * Google Drive filebrowser plugin state namespace.
 */
const NAMESPACE = 'github-filebrowser';

/**
 * The JupyterLab plugin for the GitHub Filebrowser.
 */
const fileBrowserPlugin: JupyterLabPlugin<void> = {
  id: 'jupyterlab-github:drive',
  requires: [IDocumentManager, IFileBrowserFactory, ILayoutRestorer, IStateDB],
  activate: activateFileBrowser,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateFileBrowser(app: JupyterLab, manager: IDocumentManager, factory: IFileBrowserFactory, restorer: ILayoutRestorer, state: IStateDB): void {
  const { commands } = app;

  // Add the Google Drive backend to the contents manager.
  const drive = new GitHubDrive(app.docRegistry);
  manager.services.contents.addDrive(drive);

  const browser = factory.createFileBrowser(NAMESPACE, {
    commands,
    driveName: drive.name
  });

  const gitHubBrowser = new GitHubFileBrowser(browser, drive);

  gitHubBrowser.title.iconClass = 'jp-GitHub-tablogo';
  gitHubBrowser.id = 'github-file-browser';

  // See if we have an org cached in the IStateDB.
  const id = NAMESPACE;
  Promise.all([state.fetch(id), app.restored]).then(([args]) => {
    const org = (args && args['org'] as string) || '';
    gitHubBrowser.orgName.name = org;
  });
  // Keep the IStateDB updated.
  gitHubBrowser.orgName.changed.connect((sender, args) => {
    state.save(id, { org: args.newValue });
  });

  // Add the file browser widget to the application restorer.
  restorer.add(gitHubBrowser, NAMESPACE);
  app.shell.addToLeftArea(gitHubBrowser, { rank: 102 });

  return;
}

export default fileBrowserPlugin;
