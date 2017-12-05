// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  find
} from '@phosphor/algorithm';

import {
  PanelLayout, Widget
} from '@phosphor/widgets';

import {
  ToolbarButton
} from '@jupyterlab/apputils';

import {
  URLExt
} from '@jupyterlab/coreutils';

import {
  FileBrowser
} from '@jupyterlab/filebrowser';

import {
  ObservableValue
} from '@jupyterlab/observables';

import {
  GitHubDrive, parsePath
} from './contents';


/**
 * The base url for a mybinder deployment.
 */
const MY_BINDER_BASE_URL = 'https://mybinder.org/v2/gh';

/**
 * The GitHub base url.
 */
const GITHUB_BASE_URL = 'https://github.com';

/**
 * The className for disabling the mybinder button.
 */
const MY_BINDER_DISABLED = 'jp-MyBinderButton-disabled';

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

    // Create an editable name for the user/org name.
    this.userName = new GitHubEditableName('', '<Edit User>');
    this.userName.addClass('jp-GitHubEditableUserName');
    this.userName.node.title = 'Click to edit user/organization';
    this._browser.toolbar.addItem('user', this.userName);
    this.userName.name.changed.connect(this._onUserChanged, this);

    // Create a button that opens GitHub at the appropriate
    // repo+directory.
    this._openGitHubButton = new ToolbarButton({
      onClick: () => {
        let url = GITHUB_BASE_URL;
        // If there is no valid user, open the GitHub homepage.
        if (!this._drive.validUser) {
          window.open(url);
          return;
        }
        const resource = parsePath(this._browser.model.path.split(':')[1]);
        url = URLExt.join(url, resource.user);
        if (resource.repository) {
          url = URLExt.join(url, resource.repository,
                            'tree', 'master', resource.path);
        }
        window.open(url);
      },
      className: 'jp-GitHubIcon',
      tooltip: 'Open this repository on GitHub'
    });
    this._browser.toolbar.addItem('GitHub', this._openGitHubButton);

    // Create a button the opens MyBinder to the appropriate repo.
    this._launchBinderButton = new ToolbarButton({
      onClick: () => {
        // If binder is not active for this directory, do nothing.
        if (!this._binderActive) {
          return;
        }
        const resource = parsePath(this._browser.model.path.split(':')[1]);
        const url = URLExt.join(MY_BINDER_BASE_URL, resource.user,
                                resource.repository, 'master'); 
        window.open(url+'?urlpath=lab');
      },
      tooltip: 'Launch this repository on mybinder.org',
      className: 'jp-MyBinderButton'
    });
    this._browser.toolbar.addItem('binder', this._launchBinderButton);

    // Set up a listener to check if we can launch mybinder.
    this._browser.model.pathChanged.connect(this._onPathChanged, this);
    // Trigger an initial pathChanged to check for binder state.
    this._onPathChanged();

    this._drive.rateLimitedState.changed.connect(this._updateErrorPanel, this);
  }

  /**
   * An editable widget hosting the current user name.
   */
  readonly userName: GitHubEditableName;

  /**
   * React to a change in user.
   */
  private _onUserChanged(sender: ObservableValue, args: ObservableValue.IChangedArgs) {
    if (this._changeGuard) {
      return;
    }
    this._changeGuard = true;
    this._browser.model.cd(`/${args.newValue as string}`).then(() => {
      this._changeGuard = false;
      this._updateErrorPanel();
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
   * React to the path changing for the browser.
   */
  private _onPathChanged(): void {
    const resource = parsePath(this._browser.model.path.split(':')[1]);

    // If we have navigated to the root, reset the user name.
    if (!resource.user && !this._changeGuard) {
      this._changeGuard = true;
      this.userName.name.set('');
      this._changeGuard = false;
      this._updateErrorPanel();
    }

    // Check for a valid user.
    if(!this._drive.validUser) {
      this._launchBinderButton.addClass(MY_BINDER_DISABLED);
      this._binderActive = false;
      return;
    }
    // Check for a valid repo.
    if (!resource.repository) {
      this._launchBinderButton.addClass(MY_BINDER_DISABLED);
      this._binderActive = false;
      return;
    }
    // Check for one of the special values indicating we can
    // launch the repository.
    const item = find(this._browser.model.items(), i => {
      return i.name === 'requirements.txt' || i.name === 'environment.yml' ||
             i.name === 'apt.txt' || i.name === 'REQUIRE' ||
             i.name === 'Dockerfile';
    });
    if (item) {
      this._launchBinderButton.removeClass(MY_BINDER_DISABLED);
      this._binderActive = true;
      return;
    }
    this._launchBinderButton.addClass(MY_BINDER_DISABLED);
    this._binderActive = false;
  }

  /**
   * React to a change in the validity of the drive.
   */
  private _updateErrorPanel(): void {
    const resource = parsePath(this._browser.model.path.split(':')[1]);
    const rateLimited = this._drive.rateLimitedState.get();
    const validUser = this._drive.validUser;

    // If we currently have an error panel, remove it.
    if (this._errorPanel) {
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.removeChild(this._errorPanel.node);
      this._errorPanel.dispose();
      this._errorPanel = null;
    }

    // If we are being rate limited, make an error panel.
    if (rateLimited) {
      this._errorPanel = new GitHubErrorPanel(
        'You have been rate limited by GitHub! '+
        'You will need to wait about an hour before '+
        'continuing');
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
    }

    // If we have an invalid user, make an error panel.
    if (!validUser) {
      const message = resource.user ?
        `"${resource.user}" appears to be an invalid user name!` :
        'Please enter a GitHub user name';
      this._errorPanel = new GitHubErrorPanel(message);
      const listing = (this._browser.layout as PanelLayout).widgets[2];
      listing.node.appendChild(this._errorPanel.node);
    }
  }

  private _browser: FileBrowser;
  private _drive: GitHubDrive;
  private _errorPanel: GitHubErrorPanel | null;
  private _openGitHubButton: ToolbarButton;
  private _launchBinderButton: ToolbarButton;
  private _binderActive = false;
  private _changeGuard = false;
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
    this._nameNode.className = 'jp-GitHubEditableName-display';
    this._editNode = document.createElement('input');
    this._editNode.className = 'jp-GitHubEditableName-input';

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
        if (this.name.get() !== value) {
          this.name.set(value);
        }
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
    let initialValue = text.textContent || '';
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
