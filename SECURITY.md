# Security Policy

## Scope

This project is designed for **local use only**. It runs an Express server on `localhost:3001`
and a Vite dev server on `localhost:3000`. It is not intended to be exposed to the public internet.

## API Keys

API keys (Gemini, Anthropic) are stored in `.env.local`, which is git-ignored.  
They are injected into the Vite bundle at build time — **do not deploy a production build publicly**
without first moving the AI calls to a server-side proxy.

## Reporting a Vulnerability

If you find a security issue, open a GitHub issue with the label `security`.  
For sensitive disclosures, contact: ferreira.vincent14@gmail.com

## Dependency Audits

Run `npm audit` regularly to check for known CVEs in dependencies.  
`npm audit fix` resolves most issues automatically.
