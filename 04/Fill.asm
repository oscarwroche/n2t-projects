// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input.
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel;
// the screen should remain fully black as long as the key is pressed. 
// When no key is pressed, the program clears the screen, i.e. writes
// "white" in every pixel;
// the screen should remain fully clear as long as no key is pressed.

// Put your code here.

@0
D=A
@lastKey
M=D
@currentKey
M=D
@color
M=D

(MAINLOOP)
@currentKey
D=M
@lastKey
M=D // set lastKey to currentKey

@KBD
D=M
@currentKey
M=D // set currentKey to the key pressed on keyboard
@lastKey
D=D-M
@MAINLOOP
D;JEQ // if lastKey = currentKey jump to MAINLOOP

@lastKey
D=M
@SETCOLORBLACK
D;JEQ // if lastKey = 0 go to SETCOLORBLACK

@currentKey
D=M
@SETCOLORWHITE
D;JEQ // if currentKey = 0 go to SETCOLORWHITE

@MAINLOOP
0;JMP // else go to MAINLOOP

(SETCOLORWHITE)
@0
D=A
@color
M=D // set color to 0
@COLORSCREEN
0;JMP

(SETCOLORBLACK)
@0
D=A
@1
D=D-A
@color
M=D // set color to -1
@COLORSCREEN
0;JMP

(COLORSCREEN)
@SCREEN
D=A
@i
M=D
(LOOP)
@KBD
D=A
@i
D=M-D
@MAINLOOP
D;JEQ
@color
D=M
@i
A=M
M=D
@1
D=A
@i
M=M+D
@LOOP
0;JMP

