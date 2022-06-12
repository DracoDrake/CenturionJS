/**
 * Card.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */
import Machine from "./Machine";

export interface CardOptions {
}

export default class Card {
    machine: Machine

    constructor(machine: Machine, options: CardOptions) {
        this.machine = machine
    }

    init() {
    }

    reset() {

    }

    read_U8(addr: number): number {
        return NaN
    }
    
    read_I8(addr: number): number {
        return this.read_U8(addr) << 24 >> 24
    }
    
    read_U16(addr: number): number {
        return this.read_U8(addr) << 8 | this.read_U8(addr + 1)
    }
    
    read_I16(addr: number): number {
        return this.read_I8(addr) << 8 | this.read_U8(addr + 1)
    }
       
    write_U8(addr: number, value: number) {
        
    }
    
    write_I8(addr: number, value: number) {
        this.write_U8(addr, value & 0xFF)
    }
    
    write_U16(addr: number, value: number) {
        this.write_U8(addr, value >> 8)
        this.write_U8(addr + 1, value & 0xFF)
    }
    
    write_I16(addr: number, value: number) {
        this.write_U8(addr, (value & 0xFFFF) >> 8)
        this.write_U8(addr + 1, value & 0xFF)
    }      

}