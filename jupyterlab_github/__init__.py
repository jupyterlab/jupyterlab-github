from notebook.utils import url_path_join
from notebook.base.handlers import APIHandler
from tornado.httpclient import HTTPClient, HTTPRequest, HTTPError
import tornado.web as web
from tornado.httputil import url_concat
from traitlets import Unicode
from traitlets.config import Configurable

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'
GITHUB_API = 'https://api.github.com'

class GitHubConfig(Configurable):
    client_id = Unicode('', config=True,
        help='The Client ID for the GitHub OAuth app')
    client_secret = Unicode('', config=True,
        help='The Client secret for the GitHub OAuth app')

class GitHubHandler(APIHandler):
    def get(self, path = ''):
        c = GitHubConfig(config=self.config)
        try:
            api_path = url_path_join(GITHUB_API, path)
            if c.client_id != '' and c.client_secret != '':
                api_path = url_concat(api_path,
                    {'client_id': c.client_id, 'client_secret': c.client_secret})
            client = HTTPClient()
            request = HTTPRequest(api_path, user_agent='JupyterLab GitHub')
            response = client.fetch(request)
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
