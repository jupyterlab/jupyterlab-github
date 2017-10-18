// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Signal, ISignal
} from '@phosphor/signaling';

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  IChangedArgs
} from '@jupyterlab/coreutils';

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

    const orgLabel = new Widget();
    orgLabel.addClass('jp-GitHubOrgLabel');
    orgLabel.node.textContent = 'Org:';
    this._browser.toolbar.addItem('label', orgLabel);

    this.orgName = new GitHubEditableName(drive.org, '<Edit Organization>');
    this.orgName.addClass('jp-GitHubEditableOrgName');
    this.orgName.node.title = 'Organization';
    this._browser.toolbar.addItem('organization', this.orgName);
    this.orgName.changed.connect(this._onOrgChanged, this);
  }

  /**
   * An editable widget hosting the current org name.
   */
  readonly orgName: GitHubEditableName;

  private _onOrgChanged(sender: GitHubEditableName, args: IChangedArgs<string>) {
    this._drive.org = args.newValue;
    this._browser.model.cd('/').then( () => { this._browser.model.refresh() });
  }

  private _browser: FileBrowser;
  private _drive: GitHubDrive;
}

export
class GitHubEditableName extends Widget {
  constructor(initialName: string = '', placeholder?: string) {
    super();
    this.addClass('jp-GitHubEditableName');
    this._nameNode = document.createElement('div');
    this._editNode = document.createElement('input');
    this._editNode.className = 'jp-GitHubEditableNameInput';

    this._placeholder = placeholder || '<Edit Name>'

    this.node.appendChild(this._nameNode);
    this.name = initialName;

    this.node.onclick = () => {
      if (this._pending) {
        return;
      }
      this._pending = true;
      const oldValue = this.name;
      Private.changeField(this._nameNode, this._editNode).then(value => {
        this._pending = false;
        if (oldValue === value) {
          return;
        }
        this._changed.emit({
          name: 'name',
          oldValue,
          newValue: value
        });
      });
    }
  }

  get name(): string {
    return this._name;
  }
  set name(value: string) {
    const oldValue = this.name;
    if (oldValue === value) {
      return;
    }
    this._name = value;
    this._nameNode.textContent = value || this._placeholder;
    this._changed.emit({
      name: 'name',
      oldValue,
      newValue: value
    });
  }

  get changed(): ISignal<this, IChangedArgs<string>> {
    return this._changed;
  }


  private _changed = new Signal<this, IChangedArgs<string>>(this);
  private _name: string;
  private _pending  = false;
  private _placeholder: string;
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
