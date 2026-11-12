"""Generate the combined proposal view without changing the deeper reference views."""
from pathlib import Path
from diagram import Diagram, BLUE, GREY

OUT = Path(__file__).resolve().parents[1] / 'diagrams'
GREEN = '#21735a'


def build():
    d = Diagram(1920, 740)
    d.zone(440, 45, 960, 615)
    d.zone(1450, 45, 420, 425)
    d.text(475, 65, 'AWS RECOMMENDATION WORKLOADS · eu-west-2', 26, 700, GREY)
    d.text(1480, 65, 'EXTERNAL SERVICES', 26, 700, GREY)

    def box(x, y, w, h, title, body, style='white'):
        d.box(x, y-6, w, h+12, title, body, style, tsize=32, bsize=28)

    box(50, 100, 340, 130, 'Traveller website', 'HTML / CSS / JavaScript\nResults + reasons')
    box(480, 100, 340, 130, 'API Gateway REST', 'Validate access + input\nProtected by WAF')
    box(910, 100, 450, 130, 'Recommendation Lambda', 'TypeScript / Node.js\nTime, preferences + sales')
    box(1480, 100, 360, 130, 'Traveller service', 'Preferences + flight time\nThis traveller only')
    box(50, 260, 340, 90, 'Cognito sign-in', 'AWS identity · eu-west-2')
    box(910, 330, 450, 130, 'DynamoDB catalogue', 'Complete versions + profile\nVenue facts + offers', 'dark')
    box(1480, 330, 360, 120, 'Venue + offer feeds', 'Source facts + keywords')
    box(50, 372, 340, 130, 'Scheduled work', 'Scheduler → SQS\nAWS · eu-west-2')
    box(480, 330, 340, 130, 'Refresh Lambda', 'Fetch, interpret, publish\nTypeScript / Node.js')
    box(480, 520, 340, 110, 'Bedrock', 'Nova Micro · keywords')
    box(50, 520, 340, 130, 'Website hosting', 'CloudFront (global)\nPrivate S3 · eu-west-2')
    box(910, 520, 450, 110, 'CloudWatch', 'API + refresh logs and metrics')
    box(1480, 520, 360, 110, 'Datadog · external', 'SLOs + release trends')

    d.arrow([(390, 165), (478, 165)], BLUE, 3, both=True)
    d.arrow([(820, 165), (908, 165)], BLUE, 3, both=True)
    d.arrow([(1360, 165), (1478, 165)], BLUE, 3, both=True)
    d.arrow([(1135, 230), (1135, 328)], BLUE, 3, both=True)
    d.text(1170, 265, 'Read', 28, 500, BLUE)
    d.arrow([(220, 230), (220, 258)], BLUE, 3, both=True)
    d.arrow([(390, 305), (425, 305), (425, 210), (478, 210)], GREY, 2.5, dash=True)
    d.arrow([(50, 165), (20, 165), (20, 585), (48, 585)], GREY, 2.5, both=True)
    d.arrow([(390, 445), (430, 445), (430, 395), (478, 395)], GREEN, 3)
    d.arrow([(820, 395), (908, 395)], GREEN, 3)
    d.arrow([(650, 460), (650, 518)], GREEN, 3, both=True)
    d.arrow([(745, 460), (745, 500), (1660, 500), (1660, 452)], GREEN, 3, both=True)
    d.text(1150, 471, 'Read complete source feeds', 26, 500, GREEN, 'middle')
    d.arrow([(1360, 575), (1478, 575)], GREY, 2.5)

    # This legend contains only the symbols used in the combined view.
    for x, color, label in [(50, BLUE, 'Traveller request / result'), (550, GREEN, 'Catalogue preparation'), (1050, GREY, 'Supporting connection')]:
        d.arrow([(x, 700), (x+45, 700)], color, 3)
        d.text(x+60, 684, label, 26, 500, GREY)
    d.rect(1540, 682, 30, 30, 'dark', r=4)
    d.text(1585, 684, 'Stored catalogue', 26, 500, GREY)
    d.save(str(OUT / 'solution-architecture'))
    (OUT / 'solution-architecture.prims.json').unlink()


if __name__ == '__main__':
    build()
