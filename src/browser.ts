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

    let orgName = new GitHubEditableName(drive.org);
    orgName.addClass('jp-GitHubEditableOrgName');
    orgName.node.title = 'Organization';
    this._browser.toolbar.addItem('organization', orgName);

    let separator = new Widget();
    separator.addClass('jp-GitHubSeparator');
    separator.node.textContent = '/';
    this._browser.toolbar.addItem('separator', separator);

    let repoName = new GitHubEditableName(drive.repo);
    repoName.addClass('jp-GitHubEditableRepoName');
    repoName.node.title = 'Repository';
    this._browser.toolbar.addItem('repository', repoName);
  }

  private _browser: FileBrowser;
  private _drive: GitHubDrive;
}

export
class GitHubEditableName extends Widget {
  constructor(initialName: string = '') {
    super();
    this.addClass('jp-GitHubEditableName');
    this._nameNode = document.createElement('div');
    this._editNode = document.createElement('input');
    this._editNode.className = 'jp-GitHubEditableNameInput';

    this.node.appendChild(this._nameNode);
    this.name = initialName;

    this.node.onclick = () => {
      if (this._pending) {
        return;
      }
      this._pending = true;
      Private.changeField(this._nameNode, this._editNode).then(value => {
        this._pending = false;
      });
    }
  }

  get name(): string {
    return this._nameNode.textContent;
  }
  set name(value: string) {
    this._nameNode.textContent = value;
  }

  private _pending  = false;
  private _nameNode: HTMLElement;
  private _editNode: HTMLInputElement;
}



namespace Private {
  export
  /**
   * Given a text node and an input element, replace the text
   * node wiht the input element, allowing the user to reset the
   * value of the text node.
   *
   * @param text - The node to make editable.
   *
   * @param edit - The input element to replace it with.
   *
   * @returns a Promise that resolves when the editing is complete,
   *   or has been canceled.
   */
  function changeField(text: HTMLElement, edit: HTMLInputElement): Promise<string> {
    // Replace the text node with an the input element,
    // setting the value and width of the input element to
    // the same as the text node.
    let parent = text.parentElement as HTMLElement;
    let initialValue = text.textContent;
    edit.value = initialValue;
    parent.style.width = String(parent.offsetWidth+3)+'px';
    parent.replaceChild(edit, text);
    edit.focus();

    // Highlight the input element
    let index = edit.value.lastIndexOf('.');
    if (index === -1) {
      edit.setSelectionRange(0, edit.value.length);
    } else {
      edit.setSelectionRange(0, index);
    }

    return new Promise<string>((resolve, reject) => {
      edit.onblur = () => {
        // Restore the correct width and set the
        // text content of the original node, then
        // replace the node.
        parent.style.width = '';
        parent.replaceChild(text, edit);
        text.textContent = edit.value || initialValue;
        resolve(edit.value);
      };
      edit.onkeydown = (event: KeyboardEvent) => {
        switch (event.keyCode) {
        case 13:  // Enter
          event.stopPropagation();
          event.preventDefault();
          edit.blur();
          break;
        case 27:  // Escape
          event.stopPropagation();
          event.preventDefault();
          edit.value = initialValue;
          edit.blur();
          break;
        default:
          break;
        }
      };
    });
  }
}
