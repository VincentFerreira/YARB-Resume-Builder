FROM node:23-bookworm-slim

# Install TeX Live packages required by the CV template
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-pictures \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /yarb

COPY package*.json ./
RUN npm ci

COPY . .

ENV PDFLATEX_PATH=/usr/bin/pdflatex

EXPOSE 3000 3001

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]
