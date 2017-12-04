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
  ReadonlyJSONObject
} from '@phosphor/coreutils';

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

  // See if we have an user cached in the IStateDB.
  // Warning: there is a potential race condition here: if the filebrowser
  // tries to restore its directory before the user is reset, we will
  // overwrite that cwd. Otherwise we will not.
  const id = NAMESPACE;
  state.fetch(id).then(args => {
    const user = (args && (args as ReadonlyJSONObject)['user'] as string) || '';
    gitHubBrowser.userName.name.set(user);
  });
  // Keep the IStateDB updated.
  gitHubBrowser.userName.name.changed.connect((sender, args) => {
    state.save(id, { user: args.newValue });
  });

  // Add the file browser widget to the application restorer.
  restorer.add(gitHubBrowser, NAMESPACE);
  app.shell.addToLeftArea(gitHubBrowser, { rank: 102 });

  return;
}

export default fileBrowserPlugin;
