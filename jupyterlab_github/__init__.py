from notebook.utils import url_path_join
from notebook.base.handlers import APIHandler
from tornado.httpclient import HTTPClient, HTTPRequest
import tornado.web as web

path_regex = r'(?P<path>(?:(?:/[^/]+)+|/?))'
GITHUB_API = 'https://api.github.com'

class GitHubHandler(APIHandler):
    def get(self, path = ''):
        try:
            api_path = url_path_join(GITHUB_API, path)
            client = HTTPClient()
            request = HTTPRequest(api_path, user_agent='JupyterLab GitHub')
            response = client.fetch(request)
            self.finish(response.body)
        except web.HTTPError as err:
            self.set_status(err.status)
            self.finish(err.reason);

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
