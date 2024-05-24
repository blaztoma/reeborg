from reeborg_en import move, RUR

RUR.control.set_trace_style(RUR.get_current_world().robots[0], "invisible")

def up(n=1):
    RUR.CURRENT_WORLD.robots[0]._orientation = RUR.NORTH
    for i in range(n):
        move()
haut = up
aukštyn = up

def down(n=1):
    RUR.CURRENT_WORLD.robots[0]._orientation = RUR.SOUTH
    for i in range(n):
        move()
bas = down
žemyn = down

def left(n=1):
    RUR.CURRENT_WORLD.robots[0]._orientation = RUR.WEST
    for i in range(n):
        move()
gauche = left
kairėn = left

def right(n=1):
    RUR.CURRENT_WORLD.robots[0]._orientation = RUR.EAST
    for i in range(n):
        move()
droite = right
dešinėn = right