"""
Setup module for the jupyterlab-github proxy extension
"""
import setuptools

setuptools.setup(
    name='jupyterlab_github',
    description='A Jupyter Notebook server extension which acts as a proxy for GitHub API requests.',
    version='0.2.0',
    packages=setuptools.find_packages(),
    author          = 'Jupyter Development Team',
    author_email    = 'jupyter@googlegroups.com',
    url             = 'http://jupyter.org',
    license         = 'BSD',
    platforms       = "Linux, Mac OS X, Windows",
    keywords        = ['Jupyter', 'JupyterLab', 'GitHub'],
    classifiers     = [
        'Intended Audience :: Developers',
        'Intended Audience :: System Administrators',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
    ],
    install_requires=[
        'notebook'
    ],
    package_data={'jupyterlab_github':['*']},
)
