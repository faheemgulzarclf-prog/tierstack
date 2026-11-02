s=open('shell2.html').read()
out=s.replace('<!--FORM-->',open('form.html').read()).replace('/*ENGINE*/',open('engine.js').read()).replace('/*FRONT*/',open('front.js').read()).replace('/*FIRMS*/',open('firms.js').read()).replace('/*FIRMCTL*/',open('firmctl.js').read()).replace('/*TRACKER*/',open('tracker.js').read()).replace('/*LAB*/',open('lab.js').read()).replace('/*DEMO*/',open('demo.js').read()).replace('/*ROADMAP*/',open('roadmap.js').read()).replace('<!--MOTION-->',open('motion_tail.html').read())
open('index.html','w').write(out)
import os; os.makedirs('site',exist_ok=True)
fav="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230B132B'/%3E%3Crect x='9' y='7' width='14' height='4' rx='2' fill='%235BC0DE'/%3E%3Crect x='7' y='14' width='18' height='4' rx='2' fill='%23F4D6B0'/%3E%3Crect x='5' y='21' width='22' height='4' rx='2' fill='%238297B6'/%3E%3C/svg%3E"
head=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="TierStack: a prop firm funding plan and daily coach. Build your plan in 2 minutes, then see which account to trade and how much to risk every day.">
<meta name="theme-color" content="#0B132B">
<meta property="og:title" content="TierStack · Prop firm plan + daily coach">
<meta property="og:description" content="Two tests today. A funded portfolio tomorrow. Plan, firm rules and a daily coach.">
<meta property="og:type" content="website">
<link rel="icon" href="{fav}">
'''
body=out.replace('<title>TierStack</title>','<title>TierStack · Prop firm plan + daily coach</title>',1)
# split: everything up to </style> is head, rest is body
i=body.index('</style>')+len('</style>')
auth='<script src="vendor/supabase.js"></script>\n<script>'+open('auth.js').read()+'</script>\n'
site=head+body[:i]+auth+'\n</head>\n<body>\n'+body[i:]+'\n</body>\n</html>\n'
open('site/index.html','w').write(site)
print(len(site))
