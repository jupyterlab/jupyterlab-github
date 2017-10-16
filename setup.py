"""
Setup module for the jupyterlab-github proxy extension
"""
import setuptools

setuptools.setup(
    name='jupyterlab_github',
    version='0.1.0',
    packages=setuptools.find_packages(),
    install_requires=[
        'notebook'
    ],
    package_data={'jupyterlab_github':['*']},
)
