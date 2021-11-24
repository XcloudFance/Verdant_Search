cd CubeQL
start uvicorn CubeQL:app --reload --port 1278
cd ../Spider
start python CDS-Distributed.py
python CDS-updator.py