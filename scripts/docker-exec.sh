docker exec -it $(docker container ls -a --format '{{.Image}}' | grep ifind_scripts) /bin/bash