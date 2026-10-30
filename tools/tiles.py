import cv2, sys
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')
out = sys.argv[1]
xs=[(0,880),(840,1730)]; ys=[(0,820),(780,1584)]
for i,(y0,y1) in enumerate(ys):
  for j,(x0,x1) in enumerate(xs):
    t = im[y0:y1,x0:x1].copy()
    for x in range((x0//100+1)*100, x1, 100):
        cv2.line(t,(x-x0,0),(x-x0,t.shape[0]),(0,0,255),1); cv2.putText(t,str(x),(x-x0+2,12),0,0.45,(0,0,255),1)
    for y in range((y0//100+1)*100, y1, 100):
        cv2.line(t,(0,y-y0),(t.shape[1],y-y0),(255,0,0),1); cv2.putText(t,str(y),(2,y-y0-2),0,0.45,(255,0,0),1)
    cv2.imwrite(f'{out}/tile{i}{j}.png', t)
