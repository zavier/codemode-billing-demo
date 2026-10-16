import json, sys, os
p = sys.argv[1]
top, nested, usage = {}, 0, {}
def walk(o):
    global nested
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "name" and isinstance(v, str): top[v] = top.get(v, 0) + 1
            if k == "usage" and isinstance(v, dict): usage.update({x: y for x, y in v.items() if isinstance(y, (int, float))})
            if k == "nestedCalls" and isinstance(v, dict):
                for c in v.get("calls") or []:
                    if isinstance(c, dict):
                        n = c.get("name") or c.get("tool") or "?"
                        top["nested:" + str(n)] = top.get("nested:" + str(n), 0) + 1
                        nested += 1
            walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
for line in open(p):
    line = line.strip()
    if not line: continue
    try: walk(json.loads(line))
    except: pass
print("file:", os.path.basename(p))
print("calls:", {k: v for k, v in sorted(top.items())})
print("nested total:", nested)
print("usage:", {k: usage[k] for k in ("input","output","totalTokens","cacheRead","cacheWrite") if k in usage})
