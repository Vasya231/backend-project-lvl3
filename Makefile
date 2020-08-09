all: install

install: 
	npm ci

start:
	node dist/bin/page-loader.js

publish:
	npm publish --dry-run

build:
	npm run build

lint:
	npx eslint .

lintfix:
	npx eslint . --fix

test:
	DEBUG=nock.*,axios npm test

coverage:
	npx jest --coverage

watch:
	npx jest --watch