import cv2, numpy as np, sys
im = cv2.imread('../docs/maps/FAB The Bulge Game Map.jpg')
H,W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
white = (hsv[...,1] < 40) & (hsv[...,2] > 215)
# print stats for a sample: board region only (left ~ 70%)
board = np.zeros((H,W),bool); board[:, :int(W*0.70)] = True
m = (~white) & board
m = cv2.erode(m.astype(np.uint8), np.ones((3,3),np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=4)
areas = sorted(st[1:,4], reverse=True)
print(n, areas[:15], sum(1 for a in areas if a>3000))
vis = np.zeros((H,W,3),np.uint8)
rng = np.random.default_rng(1)
cols = rng.integers(60,255,(n,3)); cols[0]=0
vis = cols[lab].astype(np.uint8)
cv2.imwrite(sys.argv[1], cv2.resize(vis, None, fx=0.7, fy=0.7))
