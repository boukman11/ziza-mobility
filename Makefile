SHELL := /bin/bash

.PHONY: up build down reset core web doctor smoke seed release

up:
	docker compose up --build

build:
	docker compose build

down:
	docker compose down

reset:
	bash scripts/reset_all.sh

core:
	bash scripts/up_core.sh

web:
	bash scripts/up_web.sh

doctor:
	bash scripts/doctor.sh

smoke:
	bash scripts/smoke.sh

seed:
	bash scripts/seed_3_rides.sh

release:
	bash scripts/release_checklist.sh
