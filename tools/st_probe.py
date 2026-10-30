import cv2, numpy as np, json
im=cv2.imread('../docs/game-pieces/Sticker_Sheet.jpg'); g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
_,m=cv2.threshold(g,70,255,cv2.THRESH_BINARY_INV)
cs,hier=cv2.findContours(m,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
boxes=[]
for c in cs:
    x,y,w,h=cv2.boundingRect(c)
    if 76<=w<=100 and 76<=h<=100 and abs(w-h)<8 and cv2.contourArea(c)>0.7*w*h*0.0: 
        peri=cv2.arcLength(c,True)
        if peri>3.2*(w+h)*0.5 :
            boxes.append((x,y,w,h))
# dedupe
out=[]
for b in sorted(boxes):
    if not any(abs(b[0]-o[0])<10 and abs(b[1]-o[1])<10 for o in out): out.append(b)
print(len(out)); print(sorted(out,key=lambda b:(b[1]//60,b[0]))[:12])
vis=im.copy()
for x,y,w,h in out: cv2.rectangle(vis,(x,y),(x+w,y+h),(0,0,255),3)
cv2.imwrite('%s/st_det.jpg'%__import__('sys').argv[1],cv2.resize(vis,None,fx=0.55,fy=0.55))
json.dump(out,open('%s/boxes.json'%__import__('sys').argv[1],'w'))
