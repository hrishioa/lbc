SHELL := /bin/bash
run:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3 -m flask run --host 0.0.0.0

repl:
	source ./venv/bin/activate; \
	source ./variables.sh; \
	python3
