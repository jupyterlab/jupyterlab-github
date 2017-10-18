import tornado.gen as gen
from tornado.httputil import url_concat
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError

from traitlets import Unicode
from traitlets.config import Configurable

from notebook.utils import url_path_join
from notebook.base.handlers import APIHandler

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'
GITHUB_API = 'https://api.github.com'

class GitHubConfig(Configurable):
    """
    A Configurable that declares the 'client_id' and 'client_secret'
    parameters.
    """
    client_id = Unicode('', config=True,
        help='The Client ID for the GitHub OAuth app')
    client_secret = Unicode('', config=True,
        help='The Client secret for the GitHub OAuth app')

class GitHubHandler(APIHandler):
    """
    A proxy for the GitHub API v3.

    The purpose of this proxy is to add the 'client_id' and 'client_secret'
    tokens to the API request, which allows for a higher rate limit.
    Without this, the rate limit on unauthenticated calls is so limited as
    to be practically useless.
    """
    @gen.coroutine
    def get(self, path = ''):
        """
        Proxy API requests to GitHub, adding 'client_id' and 'client_secret'
        if they have been set.
        """

        # Get access to the notebook config object
        c = GitHubConfig(config=self.config)
        try:
            api_path = url_path_join(GITHUB_API, path)
            # If the config has client_id and client_secret set,
            # apply them to the request.
            if c.client_id != '' and c.client_secret != '':
                api_path = url_concat(api_path,
                    {'client_id': c.client_id,\
                     'client_secret': c.client_secret,\
                     'per_page': 100})
            client = AsyncHTTPClient()
            request = HTTPRequest(api_path, user_agent='JupyterLab GitHub')
            response = yield client.fetch(request)
            self.finish(response.body)
        except HTTPError as err:
            self.set_status(err.code)
            self.finish(err.response.body);

def _jupyter_server_extension_paths():
    return [{
        'module': 'jupyterlab_github'
    }]

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    host_pattern = '.*$'
    web_app.add_handlers(host_pattern, [(r'/github%s' % path_regex, GitHubHandler)])
