# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.158.0/containers/javascript-node/.devcontainer/base.Dockerfile

# Node.js version (bullseye = Apple ARM architecture)
ARG VARIANT="20-bullseye"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:1-${VARIANT}

# Install OS packages needed for Chromium, below.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends libnss3-dev libxrandr-dev \
        libatk-bridge2.0-0 libx11-xcb-dev libxcb-dri3-dev libxcomposite-dev \
        libxcursor-dev libxdamage-dev libcups2-dev libdrm-dev libgbm-dev \
        libasound-dev libpangocairo-1.0-0 libxss1 libgtk-3-0 libxtst-dev

# Install Chromium for use in puppeteer testing.
RUN apt-get -y install chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

# Install jsdoc globally for use in building source code documentation.
RUN su node -c "npm install -g jsdoc"
