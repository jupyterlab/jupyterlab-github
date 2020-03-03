// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { Dialog, showDialog } from '@jupyterlab/apputils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { GitHubDrive, DEFAULT_GITHUB_BASE_URL } from './contents';

import { GitHubFileBrowser } from './browser';

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
const fileBrowserPlugin: JupyterFrontEndPlugin<void> = {
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
  app: JupyterFrontEnd,
  manager: IDocumentManager,
  factory: IFileBrowserFactory,
  restorer: ILayoutRestorer,
  settingRegistry: ISettingRegistry
): void {
  // Add the GitHub backend to the contents manager.
  const drive = new GitHubDrive(app.docRegistry);
  manager.services.contents.addDrive(drive);

  // Create the embedded filebrowser. GitHub repos likely
  // don't need as often of a refresh interval as normal ones,
  // and rate-limiting can be an issue, so we give a 5 minute
  // refresh interval.
  const browser = factory.createFileBrowser(NAMESPACE, {
    driveName: drive.name,
    refreshInterval: 300000
  });

  const gitHubBrowser = new GitHubFileBrowser(browser, drive);

  gitHubBrowser.title.iconClass = 'jp-GitHub-icon jp-SideBar-tabIcon';
  gitHubBrowser.title.caption = 'Browse GitHub';

  gitHubBrowser.id = 'github-file-browser';

  // Add the file browser widget to the application restorer.
  restorer.add(gitHubBrowser, NAMESPACE);
  app.shell.add(gitHubBrowser, 'left', { rank: 102 });

  let shouldWarn = false;
  const onSettingsUpdated = async (settings: ISettingRegistry.ISettings) => {
    const baseUrl = settings.get('baseUrl').composite as
      | string
      | null
      | undefined;
    const accessToken = settings.get('accessToken').composite as
      | string
      | null
      | undefined;
    drive.baseUrl = baseUrl || DEFAULT_GITHUB_BASE_URL;
    if (accessToken) {
      let proceed = true;
      if (shouldWarn) {
        proceed = await Private.showWarning();
      }
      if (!proceed) {
        settings.remove('accessToken');
      } else {
        drive.accessToken = accessToken;
      }
    } else {
      drive.accessToken = null;
    }
  };

  // Fetch the initial state of the settings.
  Promise.all([settingRegistry.load(PLUGIN_ID), app.restored])
    .then(([settings]) => {
      settings.changed.connect(onSettingsUpdated);
      onSettingsUpdated(settings);
      // Don't warn about access token on initial page load, but do for every setting thereafter.
      shouldWarn = true;
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

/**
 * A namespace for module-private functions.
 */
namespace Private {
  /**
   * Show a warning dialog about security.
   *
   * @returns whether the user accepted the dialog.
   */
  export async function showWarning(): Promise<boolean> {
    return showDialog({
      title: 'Security Alert!',
      body:
        'Adding a client side access token can pose a security risk! ' +
        'Please consider using the server extension instead.' +
        'Do you want to continue?',
      buttons: [
        Dialog.cancelButton({ label: 'CANCEL' }),
        Dialog.warnButton({ label: 'PROCEED' })
      ]
    }).then(result => {
      if (result.button.accept) {
        return true;
      } else {
        return false;
      }
    });
  }
}
