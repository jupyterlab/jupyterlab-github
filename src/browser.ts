// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  ToolbarButton
} from '@jupyterlab/apputils';

import {
  ObservableValue, URLExt
} from '@jupyterlab/coreutils';

import {
  FileBrowser
} from '@jupyterlab/filebrowser';

import {
  GitHubDrive
} from './contents';

const MY_BINDER_BASE_URL = 'https://mybinder.org/v2/gh';
const GITHUB_BASE_URL = 'https://github.com';

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

    this.userName = new GitHubEditableName(drive.user, '<Edit User>');
    this.userName.addClass('jp-GitHubEditableUserName');
    this.userName.node.title = 'User';
    this._browser.toolbar.addItem('user', this.userName);
    this.userName.name.changed.connect(this._onUserChanged, this);

    const openGitHubButton = new ToolbarButton({
      onClick: () => {
        const user = this._drive.user;
        const path = this._browser.model.path;
        const repo = path.split('/')[0].split(':')[1];
        const repoPath = URLExt.join(...path.split('/').slice(1));
        const url = URLExt.join(GITHUB_BASE_URL, user, repo,
                                'tree', 'master', repoPath);
        window.open(url);
      },
      className: 'jp-GitHubIcon',
      tooltip: 'Open this repository on GitHub'
    });
    this._browser.toolbar.addItem('GitHub', openGitHubButton);

    const launchBinderButton = new ToolbarButton({
      onClick: () => {
        const user = this._drive.user;
        const repo = this._browser.model.path.split('/')[0].split(':')[1];
        const url = URLExt.join(MY_BINDER_BASE_URL, user, repo, 'master'); 
        window.open(url+'?urlpath=lab');
      },
      tooltip: 'Launch this repository on mybinder.org',
      className: 'jp-MyBinderButton'
    });
    this._browser.toolbar.addItem('binder', launchBinderButton);

    this._drive.rateLimitedState.changed.connect(this._updateErrorPanel, this);
    this._drive.validUserState.changed.connect(this._updateErrorPanel, this);
  }

  /**
   * An editable widget hosting the current user name.
   */
  readonly userName: GitHubEditableName;

  /**
   * React to a change in user.
   */
  private _onUserChanged(sender: ObservableValue, args: ObservableValue.IChangedArgs) {
    this._drive.user = args.newValue as string;
    // After the user has been changed, cd to their GitHub
    // root directory, since any previous directory is no
    // longer valid.
    this._browser.model.cd('/').then(() => {
      // Once we have the new listing, maybe give the file listing
      // focus. Once the input element is removed, the active element
      // appears to revert to document.body. If the user has subsequently
      // focused another element, don't focus the browser listing.
      if (document.activeElement === document.body) {
        const listing = (this._browser.layout as PanelLayout).widgets[2];
        listing.node.focus();
      }
    });
  }

  /**
   * React to a change in the validity of the drive.
   */
  private _updateErrorPanel(): void {
    const rateLimited = this._drive.rateLimitedState.get();
    const validUser = this._drive.validUserState.get();
    // If everythings is valid, and an error panel is showing, remove it.
    if (!rateLimited && validUser && this._errorPanel) {
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.removeChild(this._errorPanel.node);
      this._errorPanel.dispose();
      this._errorPanel = null;
    }

    // If we are being rate limited and there is not error panel, make one.
    if (rateLimited && !this._errorPanel) {
      this._errorPanel = new GitHubErrorPanel(
        'You have been rate limited by GitHub! '+
        'You will need to wait about an hour before '+
        'continuing');
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
    }

    // If we have an invalid user there is not error panel, make one.
    if (!validUser && !this._errorPanel) {
      const message = this._drive.user ?
        `"${this._drive.user}" appears to be an invalid user name!` :
        'Please enter a GitHub user name';
      this._errorPanel = new GitHubErrorPanel(message);
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
    }
  }

  private _browser: FileBrowser;
  private _drive: GitHubDrive;
  private _errorPanel: GitHubErrorPanel | null;
}

/**
 * A widget that hosts an editable field,
 * used to host the currently active GitHub
 * user name.
 */
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
    this.name = new ObservableValue(initialName);
    this._nameNode.textContent = initialName || this._placeholder;

    this.node.onclick = () => {
      if (this._pending) {
        return;
      }
      this._pending = true;
      Private.changeField(this._nameNode, this._editNode).then(value => {
        this._pending = false;
        this.name.set(value);
      });
    };

    this.name.changed.connect((s, args) => {
      if (args.oldValue !== args.newValue) {
        this._nameNode.textContent =
          args.newValue as string || this._placeholder;
      }
    });
  }

  /**
   * The current name of the field.
   */
  readonly name: ObservableValue;


  private _pending  = false;
  private _placeholder: string;
  private _nameNode: HTMLElement;
  private _editNode: HTMLInputElement;
}

/**
 * A widget hosting an error panel for the browser,
 * used if there is an invalid user name or if we
 * are being rate-limited.
 */
export
class GitHubErrorPanel extends Widget {
  constructor(message: string) {
    super();
    this.addClass('jp-GitHubErrorPanel');
    const image = document.createElement('div');
    const text = document.createElement('div');
    image.className = 'jp-GitHubErrorImage';
    text.className = 'jp-GitHubErrorText';
    text.textContent = message;
    this.node.appendChild(image);
    this.node.appendChild(text);
  }
}


/**
 * A module-Private namespace.
 */
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
    // Replace the text node with an the input element.
    let parent = text.parentElement as HTMLElement;
    let initialValue = text.textContent;
    edit.value = initialValue;
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
        // Set the text content of the original node, then
        // replace the node.
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
