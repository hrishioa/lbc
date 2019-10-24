SHELL := /bin/bash
run:
	source ./venv/bin/activate; \
	source ./variables.sh;
	python3 -m flask run

repl:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3
