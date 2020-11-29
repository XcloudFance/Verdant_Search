import random
import time
def mktoken():
	num = ''
	for i in range(12):
		index = random.randrange(1,4)
		if index == 1:
			ch = chr(random.randrange(ord('a'), ord('z') + 1))
		elif index == 2:
			ch = chr(random.randrange(ord('0'), ord('9') + 1))
		elif index == 3:
			ch = chr(random.randrange(ord('A'),ord('Z') + 1))

		num += ch
	print(num)
	return str(num)
def gettimestamp():
	return str(int(time.time()))