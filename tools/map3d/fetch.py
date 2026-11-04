import math,os,subprocess,concurrent.futures as cf
z=11
def t(lon,lat):
    n=2**z;x=(lon+180)/360*n;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n;return int(x),int(y)
x0,y0=t(4.6,50.9);x1,y1=t(6.9,49.45)
jobs=[(x,y) for x in range(x0,x1+1) for y in range(y0,y1+1)]
def get(j):
    x,y=j;f=f'tiles/{z}_{x}_{y}.png'
    if not os.path.exists(f): subprocess.run(['curl','-sS','-o',f,f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],check=True)
with cf.ThreadPoolExecutor(8) as e: list(e.map(get,jobs))
print(len(jobs),x0,x1,y0,y1)
