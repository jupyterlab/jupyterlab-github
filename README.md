# JupyterLab GitHub

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/jupyterlab/jupyterlab-github/master?urlpath=lab)

A JupyterLab extension for accessing GitHub repositories.

### What this extension is

When you install this extension, an additional filebrowser tab will be added
to the left area of JupyterLab. This filebrowser allows you to select GitHub
organizations and users, browse their repositories, and open the files in those
repositories. If those files are notebooks, you can run them just as you would
any other notebook. You can also attach a kernel to text files and run those.
Basically, you should be able to open any file in a repository that JupyterLab can handle.

Here is a screenshot of the plugin opening this very file on GitHub:
![gitception](https://raw.githubusercontent.com/jupyterlab/jupyterlab-github/master/gitception.png 'Gitception')

### What this extension is not

This is not an extension that provides full GitHub access, such as
saving files, making commits, forking repositories, etc.
For it to be so, it would need to more-or-less reinvent the GitHub website,
which represents a huge increase in complexity for the extension.

### A note on rate-limiting

This extension has both a client-side component (that is, JavaScript that is bundled
with JupyterLab), and a server-side component (that is, Python code that is added
to the Jupyter server). This extension _will_ work with out the server extension,
with a major caveat: when making unauthenticated requests to GitHub
(as we must do to get repository data), GitHub imposes fairly strict rate-limits
on how many requests we can make. As such, you are likely to hit that limit
within a few minutes of work. You will then have to wait up to an hour to regain access.

For that reason, we recommend that you take the time and effort to set up the server
extension as well as the lab extension, which will allow you to access higher rate-limits.
This process is described in the [installation](#Installation) section.

## Prerequisites

- JupyterLab 3.0
- A GitHub account for the server extension

## Installation

As discussed above, this extension has both a server extension and a lab extension.
Both extensions will be installed by default when installing from PyPI, but you may
have only lab extension installed if you used the Extension Manager in JupyterLab 3.x.

We recommend completing the steps described below as to not be rate-limited.
The purpose of the server extension is to add GitHub credentials that you will need to acquire
from https://github.com/settings/developers, and then to proxy your request to GitHub.

For JupyterLab version older than 3 please see the instructions on the
[2.x branch](https://github.com/jupyterlab/jupyterlab-github/tree/2.x).

### 1. Installing both server and prebuilt lab extension

To install the both the server extension and (prebuilt) lab extension, enter the following in your terminal:

```bash
pip install jupyterlab-github
```

After restarting JupyterLab, the extension should work, and you can experience
the joys of being rate-limited first-hand!

### 2. Getting your credentials from GitHub

There are two approaches to getting credentials from GitHub:
(1) you can get an access token, (2) you can register an OAuth app.
The second approach is not recommended, and will be removed in a future release.

#### Getting an access token (**recommended**)

You can get an access token by following these steps:

1.  [Verify](https://help.github.com/articles/verifying-your-email-address) your email address with GitHub.
1.  Go to your account settings on GitHub and select "Developer Settings" from the left panel.
1.  On the left, select "Personal access tokens"
1.  Click the "Generate new token" button, and enter your password.
1.  Give the token a description, and check the "**repo**" scope box.
1.  Click "Generate token"
1.  You should be given a string which will be your access token.

Remember that this token is effectively a password for your GitHub account.
_Do not_ share it online or check the token into version control,
as people can use it to access all of your data on GitHub.

#### Setting up an OAuth application (**deprecated**)

This approach to authenticating with GitHub is deprecated, and will be removed in a future release.
New users should use the access token approach.
You can register an OAuth application with GitHub by following these steps:

1.  Log into your GitHub account.
1.  Go to https://github.com/settings/developers and select the "OAuth Apps" tab on the left.
1.  Click the "New OAuth App" button.
1.  Fill out a name, homepage URL, description, and callback URL in the form.
    This extension does not actually use OAuth, so these values actually _do not matter much_,
    you just need to enter them to register the application.
1.  Click the "Register application" button.
1.  You should be taken to a new page with the new application information.
    If you see fields showing "Client ID" and "Client Secret", congratulations!
    These are the strings we need, and you have successfuly set up the application.

It is important to note that the "Client Secret" string is, as the name suggests, a secret.
_Do not_ share this value online, as people may be able to use it to impersonate you on GitHub.

### 3. Enabling and configuring the server extension

The server extension will be enabled by default on new JupyterLab installations
if you installed it with pip. If you used Extension Manager in JupyterLab 3.x,
please uninstall the extension and install it again with the instructions from point (1).

Confirm that the server extension is installed and enabled with:

```bash
jupyter server extension list
```

you should see the following:

```
- Validating jupyterlab_github...
     jupyterlab_github 3.0.0 OK
```

On some older installations (e.g. old JupyterHub versions) which use jupyter
`notebook` server instead of the new `jupyter-server`, the extension needs to
show up on the legacy `serverextensions` list (note: no space between _server_ and _extension_):

```bash
jupyter serverextension list
```

If the extension is not enabled run:

```bash
jupyter server extension enable jupyterlab_github
```

or if using the legacy `notebook` server:

```bash
jupyter serverextension enable jupyterlab_github
```

You now need to add the credentials you got from GitHub
to your server configuration file. Instructions for generating a configuration
file can be found [here](https://jupyter-server.readthedocs.io/en/stable/users/configuration.html#configuring-a-jupyter-server).
Once you have identified this file, add the following lines to it:

```python
c.GitHubConfig.access_token = '< YOUR_ACCESS_TOKEN >'
```

where "`< YOUR_ACCESS_TOKEN >`" is the string value you obtained above.
If you generated an OAuth app, instead enter the following:

```python
c.GitHubConfig.client_id = '< YOUR_CLIENT_ID >'
c.GitHubConfig.client_secret = '< YOUR_CLIENT_SECRET >'
```

where "`< YOUR_CLIENT_ID >`" and "`< YOUR_CLIENT_SECRET >`" are the app values you obtained above.

With this, you should be done! Launch JupyterLab and look for the GitHub tab on the left!

## Customization

You can set the plugin to start showing a particular repository at launch time.
Open the "Advanced Settings" editor in the Settings menu,
and under the GitHub settings add

```json
{
  "defaultRepo": "owner/repository"
}
```

where `owner` is the GitHub user/org,
and `repository` is the name of the repository you want to open.
