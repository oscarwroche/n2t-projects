// push constant 3030
@3030
D=A
@SP
A=M
M=D
@SP
M=M+1
// pop pointer 0
@0
D=A
@3
D=D+A
@13
M=D
@SP
A=M-1
D=M
@13
A=M
M=D
@SP
M=M-1
// push constant 3040
@3040
D=A
@SP
A=M
M=D
@SP
M=M+1
// pop pointer 1
@1
D=A
@3
D=D+A
@13
M=D
@SP
A=M-1
D=M
@13
A=M
M=D
@SP
M=M-1
// push constant 32
@32
D=A
@SP
A=M
M=D
@SP
M=M+1
// pop this 2
@2
D=A
@THIS
D=D+M
@13
M=D
@SP
A=M-1
D=M
@13
A=M
M=D
@SP
M=M-1
// push constant 46
@46
D=A
@SP
A=M
M=D
@SP
M=M+1
// pop that 6
@6
D=A
@THAT
D=D+M
@13
M=D
@SP
A=M-1
D=M
@13
A=M
M=D
@SP
M=M-1
// push pointer 0
@0
D=A
@3
D=D+A
A=D
D=M
@SP
A=M
M=D
@SP
M=M+1
// push pointer 1
@1
D=A
@3
D=D+A
A=D
D=M
@SP
A=M
M=D
@SP
M=M+1
// add
@SP
A=M-1
D=M
A=A-1
M=M+D
@SP
M=M-1
// push this 2
@2
D=A
@THIS
D=D+M
A=D
D=M
@SP
A=M
M=D
@SP
M=M+1
// sub
@SP
A=M-1
D=M
A=A-1
M=M-D
@SP
M=M-1
// push that 6
@6
D=A
@THAT
D=D+M
A=D
D=M
@SP
A=M
M=D
@SP
M=M+1
// add
@SP
A=M-1
D=M
A=A-1
M=M+D
@SP
M=M-1