// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterLab,
  JupyterLabPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/coreutils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { GitHubDrive } from './contents';

import { GitHubFileBrowser, DEFAULT_GITHUB_BASE_URL } from './browser';

import '../style/index.css';

/**
 * GitHub filebrowser plugin state namespace.
 */
const NAMESPACE = 'github-filebrowser';

/**
 * The ID for the plugin.
 */
const PLUGIN_ID = '@jupyterlab/github:drive';

/**
 * The JupyterLab plugin for the GitHub Filebrowser.
 */
const fileBrowserPlugin: JupyterLabPlugin<void> = {
  id: PLUGIN_ID,
  requires: [
    IDocumentManager,
    IFileBrowserFactory,
    ILayoutRestorer,
    ISettingRegistry
  ],
  activate: activateFileBrowser,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateFileBrowser(
  app: JupyterLab,
  manager: IDocumentManager,
  factory: IFileBrowserFactory,
  restorer: ILayoutRestorer,
  settingRegistry: ISettingRegistry
): void {
  const { commands } = app;

  // Add the GitHub backend to the contents manager.
  const drive = new GitHubDrive(app.docRegistry);
  manager.services.contents.addDrive(drive);

  const browser = factory.createFileBrowser(NAMESPACE, {
    commands,
    driveName: drive.name
  });

  const gitHubBrowser = new GitHubFileBrowser(browser, drive);

  gitHubBrowser.title.iconClass = 'jp-GitHub-tablogo';
  gitHubBrowser.id = 'github-file-browser';

  // Add the file browser widget to the application restorer.
  restorer.add(gitHubBrowser, NAMESPACE);
  app.shell.addToLeftArea(gitHubBrowser, { rank: 102 });

  const onSettingsUpdated = (settings: ISettingRegistry.ISettings) => {
    const baseUrl = settings.get('baseUrl').composite as
      | string
      | null
      | undefined;
    gitHubBrowser.baseUrl = baseUrl || DEFAULT_GITHUB_BASE_URL;
  };

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
      const defaultRepo = settings.get('defaultRepo').composite as
        | string
        | null;
      if (defaultRepo) {
        browser.model.restored.then(() => {
          browser.model.cd(`/${defaultRepo}`);
        });
      }
    })
    .catch((reason: Error) => {
      console.error(reason.message);
    });

  return;
}

export default fileBrowserPlugin;
