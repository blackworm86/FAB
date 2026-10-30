import cv2, numpy as np
im=cv2.imread('../docs/game-pieces/countersheet_Front.jpg'); r=cv2.rotate(im,cv2.ROTATE_90_COUNTERCLOCKWISE)
g=cv2.cvtColor(r,cv2.COLOR_BGR2GRAY)
bh=cv2.morphologyEx(g,cv2.MORPH_BLACKHAT,cv2.getStructuringElement(cv2.MORPH_RECT,(11,11)))
line=(bh>14).astype(np.uint8)
line=cv2.dilate(line,np.ones((3,3),np.uint8))
free=(1-line).astype(np.uint8)
free=cv2.erode(free,np.ones((5,5),np.uint8))
n,cc,st,cen=cv2.connectedComponentsWithStats(free,connectivity=4)
sq=[(i,st[i]) for i in range(1,n) if 120<=st[i,2]<=190 and 120<=st[i,3]<=190 and st[i,4]>0.6*st[i,2]*st[i,3]]
print(n,len(sq))
vis=r.copy()
for i,s in sq: cv2.rectangle(vis,(s[0],s[1]),(s[0]+s[2],s[1]+s[3]),(0,0,255),4)
cv2.imwrite('/tmp/claude-0/-home-user/a1c94234-d293-5e86-91af-6e8f1a3ddf07/scratchpad/cs_det.jpg',cv2.resize(vis,None,fx=0.5,fy=0.5))
