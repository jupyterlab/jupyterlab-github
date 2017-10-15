# jupyterlab-github

## Prerequisites

* JupyterLab 0.27.0

## Installation

For a development install, do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app after making changes:

```bash
npm run build
jupyter lab build
```
