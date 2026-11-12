"""Generate the six editable structural/flow views. Sequences use render-views.mjs."""
from pathlib import Path
from diagram import Diagram, BLUE, INK, GREY, NAVY
D=Path(__file__).resolve().parents[1]/'diagrams'
GREEN='#21735a'
CAP=dict(size=17,weight=700,spacing=1.2)

def save(d,name):
    d.save(str(D/name))
    (D/(name+'.prims.json')).unlink()

def legend(d,y):
    d.text(60,y,'LEGEND',**CAP)
    for i,(s,label) in enumerate([('navy','Decisions and review'),('pale','Application processing'),('dark','Persisted data'),('white','Managed/external services and notes')]):
        x=60+i*(d.w-120)/4
        d.rect(x,y+38,28,23,s,r=4);d.text(x+42,y+37,label,19,500,GREY)
    for i,(c,label) in enumerate([(BLUE,'Traveller request / result'),(GREEN,'Catalogue preparation'),(GREY,'Supporting flow / dependency')]):
        x=60+i*(d.w-120)/3
        d.arrow([(x,y+103),(x+48,y+103)],c,3)
        d.text(x+65,y+88,label,20,500,GREY)

def dependency(d,points,label,x,y):
    d.arrow(points,GREY,2.5,dash=True)
    d.ex[-1]['endArrowhead']='arrow'
    d.svg[-1]=d.svg[-1].replace('url(#ah4b5563)','url(#uml-dependency)')
    d._markers['uml-dependency']='<marker id="uml-dependency" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="6" markerHeight="6" orient="auto"><path d="M1,1 L11,6 L1,11" fill="none" stroke="#4b5563" stroke-width="1.5"/></marker>'
    d.text(x,y,label,19,500,GREY,'middle')

def component(d,x,y,w,h,name,body,style='pale'):
    d.box(x,y,w,h,'«component»\n'+name,body,style,tsize=25,bsize=20)

def overview():
    d=Diagram(1920,1220,'Airport Trip Planner: system overview',
        'Prepared venue data connects two paths. Traveller requests do not wait for a model.')
    d.text(60,200,'TRAVELLER REQUEST',**CAP)
    d.zone(920,235,960,210,'REQUEST PROCESSING',lx=945,ly=247)
    d.box(60,280,300,145,'Traveller website','Venue recommendations\nReasons and warnings','white',tsize=27,bsize=22)
    d.box(480,280,360,145,'API access','Verify identity\nand request input','white',tsize=27,bsize=22)
    d.box(960,280,360,145,'Recommendation service','Load profile, trip and catalogue\nCoordinate the response','pale',tsize=27,bsize=21)
    d.box(1440,280,400,145,'Decision rules','Time and hard constraints\nPreference ranking + reasons','navy',tsize=28,bsize=22)
    d.box(960,545,360,135,'Traveller service','Preferences + flight time\nThis traveller’s permitted record','white',tsize=27,bsize=21)
    d.box(1440,545,400,135,'Prepared catalogue','Airport profile, active pointer\nComplete venues + offers','dark',tsize=27,bsize=21)
    d.arrow([(360,352),(478,352)],BLUE,3,both=True);d.text(420,306,'HTTPS',19,500,BLUE,'middle')
    d.arrow([(840,352),(958,352)],BLUE,3,both=True);d.text(900,306,'Invoke',19,500,BLUE,'middle')
    d.arrow([(1320,320),(1438,320)],BLUE,3);d.text(1380,279,'Evaluate',18,500,BLUE,'middle')
    d.arrow([(1440,395),(1322,395)],BLUE,3);d.text(1380,410,'Result',18,500,BLUE,'middle')
    d.arrow([(1140,425),(1140,543)],BLUE,3,both=True);d.text(1170,466,'Read trip',20,500,BLUE)
    d.arrow([(1290,425),(1290,470),(1380,470),(1380,612),(1438,612)],BLUE,3)
    d.text(1480,478,'Profile first; active snapshot after trip',20,500,BLUE)
    d.box(60,545,300,135,'Venue + offer feeds','Brand keywords + source facts\nOptional sales feed','white',tsize=26,bsize=21)
    d.text(60,752,'BACKGROUND PREPARATION',**CAP)
    d.zone(440,800,920,210,'PREPARE CHANGED KEYWORDS',lx=465,ly=812)
    d.box(60,845,300,145,'Refresh jobs','Periodic airport work\nRetry failed preparation','white',tsize=27,bsize=21)
    d.box(480,845,360,145,'Catalogue preparation','Fetch sources, interpret keywords\nand publish a complete version','pale',tsize=27,bsize=21)
    d.box(960,845,360,145,'Pre-built AI model','Interpret brand keywords\nPropose concept labels','white',tsize=27,bsize=21)
    d.arrow([(360,917),(478,917)],GREEN,3);d.text(420,945,'Job',20,500,GREEN,'middle')
    d.arrow([(480,890),(420,890),(420,612),(362,612)],GREEN,3);d.text(399,710,'Fetch',20,500,GREEN,'end')
    d.arrow([(840,917),(958,917)],GREEN,3,both=True);d.text(900,950,'Classify',19,500,GREEN,'middle')
    d.arrow([(840,870),(890,870),(890,737),(1640,737),(1640,682)],GREEN,3)
    d.text(1240,698,'Publish only a complete version',22,600,GREEN,'middle')
    legend(d,1040)
    d.text(60,1185,'Logical responsibilities. The AWS deployment view shows hosting and managed services.',20,400,GREY)
    save(d,'solution-design')

def components():
    from presentation_views import backend
    backend()

def flow():
    d=Diagram(1920,1290,'How a recommendation is decided',
        'The visit starts now. Hard constraints filter venues; preferences determine their order.')
    d.box(60,420,280,130,'Trip + catalogue','Validated traveller context','pale',tsize=27,bsize=20)
    d.diamond(580,485,300,150,'Catalogue within\n4-hour limit?',style='navy',size=23)
    d.diamond(1040,485,300,150,'At least 10 usable\nminutes remain?',style='navy',size=22)
    d.box(1400,420,440,130,'Apply hard constraints','Visit fits and venue is not known closed.\nFood meets any required dietary facts.','navy',tsize=27,bsize=21)
    d.box(420,230,320,110,'No reliable data','Explain and offer retry','pale',tsize=26,bsize=21)
    d.box(880,230,320,110,'Head to the gate','No venue recommendations','pale',tsize=26,bsize=21)
    d.arrow([(340,485),(428,485)],BLUE,3)
    d.arrow([(580,410),(580,342)],BLUE,3);d.text(610,362,'No',21,700,BLUE)
    d.arrow([(730,485),(888,485)],BLUE,3);d.text(810,445,'Yes',21,700,BLUE,'middle')
    d.arrow([(1040,410),(1040,342)],BLUE,3);d.text(1070,362,'No',21,700,BLUE)
    d.arrow([(1190,485),(1398,485)],BLUE,3);d.text(1295,445,'Yes',21,700,BLUE,'middle')
    d.diamond(1040,770,300,150,'Any eligible venues?',style='navy',size=22)
    d.arrow([(1620,550),(1620,770),(1192,770)],BLUE,3)
    d.text(1590,640,'Check eligible venues',21,500,BLUE,'end')
    d.box(420,715,320,110,'No suitable places','Explain the constraints','pale',tsize=26,bsize=21)
    d.arrow([(890,770),(742,770)],BLUE,3);d.text(810,730,'No',21,700,BLUE,'middle')
    d.arrow([(1040,845),(1040,918)],BLUE,3);d.text(1070,866,'Yes',21,700,BLUE)
    d.box(880,920,960,140,'Rank and return','Preference matches first; label other venues as alternatives.\nNo preferences: valid offers, spare time, then name.\nShow source-backed offers, estimates and warnings.','navy',tsize=28,bsize=22)
    d.box(60,920,680,140,'Source facts and estimates','Food-only dietary checks; unknown hours are labelled.\nOnly fresh, visit-valid offers affect ranking.','white',tsize=27,bsize=21)
    d.line([(740,990),(878,990)],GREY,2.5,dash=True)
    d.text(60,1090,'Activity notation: rounded boxes are actions/outcomes; diamonds are decisions; branches carry guards.',21,400,GREY)
    legend(d,1140)
    save(d,'recommendation-flow')

def node(d,x,y,w,h,title,body,style='white',kind='managed service',tsize=None):
    d.rect(x,y,w,h,style,r=0)
    d.line([(x,y),(x+14,y-14),(x+w+14,y-14),(x+w,y)],GREY,2)
    d.line([(x+w,y),(x+w+14,y-14),(x+w+14,y+h-14),(x+w,y+h)],GREY,2)
    color='#ffffff' if style=='dark' else INK
    bodycolor='#d1d5db' if style=='dark' else GREY
    d.text(x+w/2,y+12,'«'+kind+'»',17,500,bodycolor,'middle')
    d.text(x+w/2,y+43,title,tsize or (25 if len(title)<23 else 22),700,color,'middle','head')
    d.text(x+w/2,y+81,body,20,400,bodycolor,'middle')

def deployment():
    d=Diagram(2200,1940,'AWS deployment',
      'UML deployment view. Regional services are in eu-west-2; CloudFront delivery is global.')
    d.box(60,275,260,125,'Traveller browser','HTML / CSS / JavaScript','white',tsize=27,bsize=20)
    node(d,440,275,300,125,'CloudFront','HTTPS static delivery',kind='global service')
    d.zone(400,485,1290,1170,'AWS REGION · eu-west-2',lx=840,ly=502)
    node(d,440,565,300,140,'Private S3 bucket','Website assets')
    node(d,840,565,300,140,'Cognito','Issuer + API scopes')
    node(d,1240,565,340,140,'API Gateway REST + WAF','Authorise and validate')
    node(d,440,850,300,140,'EventBridge Scheduler','Refresh + age-check schedules')
    node(d,840,850,300,140,'Age-check Lambda','Read catalogue age','pale',kind='executionEnvironment')
    node(d,1240,850,340,140,'Recommendation Lambda','Node.js / TypeScript','pale',kind='executionEnvironment')
    node(d,1780,850,360,140,'Traveller service','Permitted preferences + trip',kind='external service')
    node(d,440,1140,300,140,'SQS queues','Work, retry and dead letters')
    node(d,840,1140,300,140,'DynamoDB','Versions, leases and job state','dark')
    node(d,1240,1140,340,140,'Refresh Lambda','Node.js / TypeScript','pale',kind='executionEnvironment')
    node(d,1780,1140,360,140,'Venue + offer feeds','Source facts and keywords',kind='external service')
    node(d,440,1430,300,140,'Secrets Manager','Feed and test credentials')
    node(d,840,1430,300,140,'Bedrock / Nova Micro','Keyword interpretation')
    node(d,1240,1430,340,140,'CloudWatch','Logs, filters, alarms, synthetics')
    node(d,1780,1430,360,140,'Datadog','SLOs + release trends',kind='external SaaS')
    d.arrow([(320,337),(438,337)],BLUE,3);d.text(380,294,'Assets',20,500,BLUE,'middle')
    d.arrow([(590,400),(590,563)],GREY,3);d.text(620,505,'Private origin',20,500,GREY)
    d.arrow([(190,400),(190,450),(1410,450),(1410,563)],BLUE,3);d.text(1210,410,'HTTPS API',21,500,BLUE,'middle')
    d.arrow([(320,375),(360,375),(360,760),(990,760),(990,707)],BLUE,3);d.text(600,723,'Managed sign-in',20,500,BLUE,'middle')
    d.arrow([(1240,635),(1142,635)],GREY,2.5);d.text(1190,590,'Token\nchecks',17,500,GREY,'middle')
    d.arrow([(1410,705),(1410,848)],BLUE,3);d.text(1440,760,'Invoke',20,500,BLUE)
    d.arrow([(1580,920),(1778,920)],BLUE,3);d.text(1680,875,'Read own trip',20,500,BLUE,'middle')
    d.arrow([(1240,960),(1190,960),(1190,1080),(1040,1080),(1040,1138)],BLUE,3);d.text(1070,1038,'Catalogue reads',20,500,BLUE,'middle')
    d.arrow([(740,920),(838,920)],GREY,2.5);d.text(790,874,'Invoke',18,500,GREY,'middle')
    d.arrow([(900,990),(900,1138)],GREY,2.5);d.text(880,1050,'Read age',20,500,GREY,'end')
    d.arrow([(590,990),(590,1138)],GREEN,3);d.text(620,1055,'Enqueue',20,500,GREEN)
    d.arrow([(590,1280),(590,1330),(1410,1330),(1410,1282)],GREEN,3);d.text(950,1290,'SQS event source invokes worker',20,500,GREEN,'middle')
    d.arrow([(1240,1210),(1142,1210)],GREEN,3);d.text(1190,1240,'Publish',18,500,GREEN,'middle')
    d.arrow([(1580,1210),(1778,1210)],GREEN,3);d.text(1680,1165,'HTTPS feeds',20,500,GREEN,'middle')
    d.arrow([(1240,1260),(1200,1260),(1200,1370),(590,1370),(590,1428)],GREY,2.5);d.text(800,1385,'Read credentials',19,500,GREY,'middle')
    d.arrow([(1360,1280),(1360,1405),(990,1405),(990,1428)],GREEN,3);d.text(1300,1379,'Interpret',19,500,GREEN,'end')
    d.arrow([(1500,1280),(1500,1428)],GREY,2.5);d.text(1525,1360,'Logs + signals',19,500,GREY)
    d.arrow([(1580,1500),(1778,1500)],GREY,3);d.text(1680,1448,'AWS metrics;\nselected logs',19,500,GREY,'middle')
    d.text(60,1690,'UML nodes show managed services or execution environments. CDK defines deployment; detailed telemetry is in the monitoring view.',21,400,GREY)
    legend(d,1750)
    d.text(60,1890,'Arrows are labelled communications, not network topology. Settings belong in supporting detail, not resource boxes.',21,400,GREY)
    save(d,'solution-deployment')

def monitoring():
    d=Diagram(2200,1540,'Monitoring and design improvement',
        'Each indicator has one primary source. Reviewed evidence leads to a change and a post-release comparison.')
    sources=[('API Gateway','Final HTTP status + total latency'),('Recommendation Lambda','Final outcome + catalogue age'),('Worker + age checker','Refresh, age, model usage + cost')]
    for i,(t,b) in enumerate(sources):d.box(60,245+i*170,450,125,t,b,'white' if i==0 else 'pale',tsize=28,bsize=21)
    d.box(680,390,570,180,'CloudWatch','Safe logs → metric filters → good/bad counts\nPlatform alarms + independent synthetic journey','white',tsize=30,bsize=23)
    d.box(1570,390,560,180,'Datadog','Approved AWS metrics + selected redacted logs\nSLO trends, burn rate and release comparisons','white',tsize=30,bsize=23)
    for y in [307,477,647]:d.arrow([(510,y),(585,y),(585,480),(678,480)],GREY,2.5)
    d.arrow([(1250,480),(1568,480)],GREY,3);d.text(1410,415,'AWS integration /\nselected forwarding',21,500,GREY,'middle')
    d.text(680,625,'Telemetry is filtered before ingestion. Collection gaps and duplicates remain visible.',21,400,GREY)
    d.box(1570,790,560,140,'Review evidence','Service measures + quality samples + cost\nCustomer reports and an improvement hypothesis','navy',tsize=28,bsize=22)
    d.box(60,790,450,140,'Customer feedback','Reviewed, anonymised examples','white',tsize=28,bsize=22)
    d.arrow([(1850,570),(1850,788)],GREY,3)
    d.arrow([(510,860),(1568,860)],GREY,3);d.text(1000,819,'Product and engineering review',22,500,GREY,'middle')
    d.box(1570,1100,560,140,'Approve a bounded change','Rules, prompt, model, cache or capacity','navy',tsize=28,bsize=22)
    d.box(810,1100,570,140,'Validate against the baseline','Replay, load, security and quality checks','pale',tsize=28,bsize=22)
    d.box(60,1100,560,140,'Release and compare','Human approval; same measures after release\nKeep, adjust or reverse the change','navy',tsize=28,bsize=22)
    d.arrow([(1850,930),(1850,1098)],GREY,3)
    d.arrow([(1570,1170),(1382,1170)],GREY,3)
    d.arrow([(810,1170),(622,1170)],GREY,3)
    d.arrow([(340,1100),(340,1020),(25,1020),(25,477),(58,477)],GREY,2.5,dash=True)
    d.text(60,1300,'Dashed loop: a released change affects service behaviour. Telemetry export never blocks a recommendation or refresh.',22,400,GREY)
    legend(d,1360)
    save(d,'monitoring-feedback')


def aws_overview():
    from presentation_views import aws
    aws()

if __name__=='__main__':
    overview();components();flow();deployment();monitoring();aws_overview()
    print('Built six native Excalidraw views and matching SVG exports.')
