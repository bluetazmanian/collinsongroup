"""The three proposal views: AWS deployment, backend components and frontend."""
from pathlib import Path
from diagram import Diagram, BLUE, GREY, INK

OUT = Path(__file__).resolve().parents[1] / 'diagrams'
GREEN = '#21735a'


def save(d, name):
    d.save(str(OUT / name))
    (OUT / (name + '.prims.json')).unlink()


def uses(d, points, label=None, x=None, y=None):
    """UML usage dependency: dashed line with an open arrowhead."""
    d.arrow(points, GREY, 2.5, dash=True)
    d.ex[-1]['endArrowhead'] = 'arrow'
    d.svg[-1] = d.svg[-1].replace('url(#ah4b5563)', 'url(#uses-arrow)')
    d._markers['uses-arrow'] = '<marker id="uses-arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="6" markerHeight="6" orient="auto"><path d="M1,1 L11,6 L1,11" fill="none" stroke="#4b5563" stroke-width="1.6"/></marker>'
    if label:
        d.text(x, y, label, 27, 500, GREY, 'middle')


def component(d, x, y, w, title, body, style='pale', h=130):
    """UML component rectangle, identified by the standard component icon."""
    svg_start, ex_start = len(d.svg), len(d.ex)
    d.box(x, y, w, h, title, body, style, tsize=28, bsize=28)
    d.svg[svg_start] = d.svg[svg_start].replace('rx="16"', 'rx="0"')
    d.ex[ex_start]['roundness'] = None
    icon_start = len(d.ex)
    component_icon(d, x+w-42, y+9, '#ffffff' if style == 'navy' else GREY)
    for element in d.ex[icon_start:]:
        element['groupIds'] = d.ex[ex_start]['groupIds'].copy()


def component_icon(d, x, y, color=GREY):
    d.line([(x,y),(x+24,y),(x+24,y+25),(x,y+25),(x,y)],color,1.8)
    for dy in (5,16):
        d.line([(x-5,y+dy),(x+6,y+dy),(x+6,y+dy+5),(x-5,y+dy+5),(x-5,y+dy)],color,1.8)


def legend(d, y, items):
    for x, style, label in items:
        if style == 'uses':
            uses(d, [(x, y+18), (x+55, y+18)])
        elif style.startswith('#'):
            d.arrow([(x, y+18), (x+55, y+18)], style, 3)
        else:
            d.rect(x, y, 38, 34, style, r=5)
        d.text(x+70, y, label, 27, 500, GREY)


def aws():
    """AWS deployment and browser entry points; frontend internals have their own view."""
    d = Diagram(2400, 1020)
    d.zone(480, 50, 1470, 900)
    d.text(520,65,'AWS REGION',34,700,GREY,font='head')
    d.text(60,95,'AWS GLOBAL',31,700,GREY,font='head')
    d.text(2010,95,'EXTERNAL SERVICES',28,700,GREY,font='head')

    def node(x,y,w,title,body,style='white',group=False):
        h=130
        d.rect(x,y,w,h,style,r=0)
        if group:
            d.svg[-1]=d.svg[-1].replace('stroke-width="2"','stroke-width="2" stroke-dasharray="9 7"')
            d.ex[-1]['strokeStyle']='dashed'
        else:
            d.line([(x,y),(x+12,y-12),(x+w+12,y-12),(x+w,y)],GREY,2)
            d.line([(x+w,y),(x+w+12,y-12),(x+w+12,y+h-12),(x+w,y+h)],GREY,2)
        color='#ffffff' if style=='dark' else INK
        bodycolor='#d1d5db' if style=='dark' else GREY
        top=y+(h-34*1.3-29*1.3-8)/2
        d.text(x+w/2,top,title,34,700,color,'middle','head')
        d.text(x+w/2,top+34*1.3+8,body,29,400,bodycolor,'middle')

    node(60,150,340,'CloudFront','Website delivery')
    d.text(60,410,'USER DEVICE',28,700,GREY,font='head')
    node(60,460,340,'Browser','Traveller website')
    node(520,150,350,'Private S3','Website assets')
    node(1040,150,390,'Cognito','Managed sign-in')
    d.text(1570,155,'AWS CDK',32,700,GREY,font='head')
    d.text(1570,203,'Cloud Development Kit\nInfrastructure as code',28,400,GREY)

    node(520,460,350,'API Gateway REST','Cognito + WAF')
    node(1040,350,390,'Recommendations','Lambda · TypeScript')
    node(2030,350,320,'Traveller service','Trip + preferences')
    node(1040,530,390,'DynamoDB','Shared catalogue','dark')

    node(520,710,350,'Scheduler + SQS','15-minute schedule',group=True)
    node(1040,710,390,'Refresh Lambda','Node.js / TypeScript')
    node(1570,530,350,'Bedrock','Nova Micro')
    node(2000,710,350,'Venue + sales','External feeds')

    d.arrow([(400,215),(518,215)],GREY,3)
    d.arrow([(300,460),(300,282)],BLUE,3.2)
    d.text(80,330,'Website files',28,500,BLUE)
    d.arrow([(400,525),(518,525)],BLUE,3.2)
    d.text(440,475,'API',28,500,BLUE,'middle')
    d.arrow([(350,460),(350,330),(940,330),(940,215),(1038,215)],BLUE,3.2)
    d.text(650,290,'Sign in',28,500,BLUE,'middle')
    uses(d,[(850,460),(850,350),(1000,350),(1000,270),(1038,270)])
    d.text(1090,295,'Token authorizer',28,500,GREY)
    d.arrow([(870,525),(960,525),(960,415),(1038,415)],BLUE,3.2)
    d.text(955,550,'Invoke',29,500,BLUE,'middle')
    d.arrow([(1430,415),(2028,415)],BLUE,3.2)
    d.text(1740,365,'Read trip',31,500,BLUE,'middle')
    d.arrow([(1235,480),(1235,528)],BLUE,3.2)
    d.arrow([(870,775),(1038,775)],GREEN,3.2)
    d.arrow([(1235,710),(1235,662)],GREEN,3.2)
    d.arrow([(1430,730),(1490,730),(1490,595),(1568,595)],GREEN,3.2)
    d.arrow([(1430,775),(1998,775)],GREEN,3.2)

    # Monitoring names its scope once; per-function arrows would repeat it.
    d.rect(520,880,1390,65,'white',r=0)
    d.text(545,892,'CloudWatch',31,700,INK,font='head')
    d.text(820,897,'API + Lambda logs, metrics and alarms',28,400,GREY)
    d.rect(2000,880,350,65,'white',r=0)
    d.text(2175,892,'Datadog SLOs',31,700,INK,'middle','head')
    d.arrow([(1910,912),(1998,912)],GREY,3)

    for x,color,label in [(50,BLUE,'Browser / API calls'),(400,GREEN,'Refresh calls'),(800,GREY,'Delivery / metrics')]:
        d.arrow([(x,993),(x+55,993)],color,3)
        d.text(x+70,975,label,28,500,GREY)
    uses(d,[(1280,993),(1335,993)])
    d.text(1350,975,'Configuration',28,500,GREY)
    d.rect(1660,973,38,34,'dark',r=0)
    d.text(1715,975,'Shared data',28,500,GREY)
    d.rect(1990,973,45,34,'white',r=0)
    d.svg[-1]=d.svg[-1].replace('stroke-width="2"','stroke-width="2" stroke-dasharray="9 7"')
    d.ex[-1]['strokeStyle']='dashed'
    d.text(2060,975,'Grouped services',28,500,GREY)
    save(d,'aws-overview')


def backend():
    d = Diagram(2200, 850)
    d.zone(40,45,1040,550)
    d.zone(1120,45,1040,550)
    d.text(75,65,'RECOMMENDATION LAMBDA · TypeScript / Node.js',28,700,GREY,font='head')
    d.text(1155,65,'REFRESH LAMBDA · TypeScript / Node.js',28,700,GREY,font='head')
    component(d,90,120,430,'Request handler','Checks access; loads data',h=150)
    component(d,610,120,430,'Traveller adapter','Reads the signed-in trip',h=150)
    component(d,90,410,430,'Catalogue reader','Reads prepared venue data',h=150)
    component(d,610,410,430,'Decision rules','Time, preferences and offers','navy',h=150)
    component(d,1160,120,430,'Refresh coordinator','Coordinates venue updates',h=150)
    component(d,1680,120,430,'Feed adapters','Reads venues and sales',h=150)
    component(d,1160,410,430,'Catalogue writer','Stores updated venue data',h=150)
    component(d,1680,410,430,'Keyword interpreter','Bedrock + keyword list',h=150)
    uses(d,[(520,210),(608,210)],'trip',565,150)
    uses(d,[(305,270),(305,408)],'read',355,315)
    uses(d,[(450,270),(450,360),(825,360),(825,408)],'evaluate',650,310)
    uses(d,[(1590,210),(1678,210)],'fetch',1635,150)
    uses(d,[(1375,270),(1375,408)],'publish',1435,315)
    uses(d,[(1520,270),(1520,360),(1895,360),(1895,408)],'interpret',1730,310)
    d.box(60,655,2080,120,'Shared TypeScript types','Shop categories, venue data and recommendation results','white',tsize=29,bsize=28)
    uses(d,[(825,560),(825,653)])
    uses(d,[(1895,560),(1895,653)])
    legend(d,805,[(60,'pale','UML component'),(650,'navy','Decision rules'),(1200,'white','Shared types'),(1720,'uses','Uses')])
    component_icon(d,70,810)
    save(d,'solution-components')


def frontend():
    d = Diagram(2200, 1000)
    d.zone(50,45,1520,815)
    d.zone(1600,45,550,815)
    d.text(90,60,'BROWSER APPLICATION · HTML / CSS / JavaScript',28,700,GREY,font='head')
    d.text(1640,60,'IDENTITY AND SERVICE APIS',28,700,GREY,font='head')
    component(d,100,160,480,'Screen controller','Forms, navigation + results',h=160)
    component(d,100,440,480,'Session + trip state','Access token held in memory',h=160)
    component(d,800,130,500,'Authentication','Code flow + PKCE',h=160)
    component(d,800,390,500,'Traveller client','Own trip API',h=160)
    component(d,800,650,500,'Recommendation client','Authenticated Fetch request',h=160)
    d.box(1640,130,470,160,'Cognito','Managed sign-in','white',tsize=31,bsize=28)
    d.box(1640,390,470,160,'Traveller service','Saved preferences + flight','white',tsize=31,bsize=28)
    d.box(1640,650,470,160,'API Gateway','Recommendation request','white',tsize=31,bsize=28)
    uses(d,[(580,210),(798,210)])
    uses(d,[(580,260),(650,260),(650,470),(798,470)])
    uses(d,[(580,305),(600,305),(600,730),(798,730)])
    uses(d,[(300,320),(300,438)],'uses state',400,365)
    d.arrow([(1300,210),(1638,210)],BLUE,3,both=True)
    d.text(1470,160,'Sign in',28,500,BLUE,'middle')
    d.arrow([(1300,470),(1638,470)],BLUE,3,both=True)
    d.text(1438,420,'Read / update trip*',28,500,BLUE,'middle')
    d.arrow([(1300,730),(1638,730)],BLUE,3,both=True)
    d.text(1438,680,'Recommendations',28,500,BLUE,'middle')
    legend(d,900,[(60,'pale','Browser component'),(750,'white','External API'),(1460,'uses','Uses'),(1830,BLUE,'HTTPS')])
    component_icon(d,70,905)
    d.text(60,955,'* Preference edits depend on traveller service support.',28,400,GREY)
    save(d,'frontend-design')


if __name__ == '__main__':
    aws()
    backend()
    frontend()
    print('Built the AWS, backend and frontend proposal views.')
