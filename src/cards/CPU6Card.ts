/**
 * CPU6Card.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from '../Defines'
import { DEBUG_captureInstr, DEBUG_captureInstrBranch, DEBUG_captureInstrWithAM, 
    DEBUG_clear, DEBUG_fetchCapture, DEBUG_fetchCaptureAddr, DEBUG_fetchCapturePC, DEBUG_Print, DEBUG_PrintOp, DEBUG_PrintRegisters } from '../Debug'
import CPU, { CPUOptions } from "../CPU"
import Machine from "../Machine"
import { opcode_table } from './CPU6/CPU6'

export interface DMA_Status {
    addr: number
    count: number
    enabled: boolean
    mode: number
}

export interface CPU_Status {
    pc: number
    flags: number
    ipl: number
    interrupt_enable: boolean
    halt: boolean
    dma: DMA_Status
    need_delay: boolean
    mmu_base: number
}

export enum REG {
    A = 0,
    AHH = 1,
    B = 2,
    BHH = 3,
    X = 4,
    XHH = 5,
    Y = 6,
    YHH = 7,
    Z = 8,
    ZHH = 9,
    S = 10,
    SHH = 11,
    C = 12,
    CHH = 13,
    P = 14,
    PHH = 15
}

export enum REGB {
    AH = 0,
    AL = 1,
    BH = 2,
    BL = 3,
    XH = 4,
    XL = 5,
    YH = 6,
    YL = 7,
    ZH = 8,
    ZL = 9,
    SH = 10,
    SL = 11,
    CH = 12,
    CL = 13,
    PH = 14,
    PL = 15
}

export interface CPU6Options extends CPUOptions {

}

export default class CPU6Card extends CPU {
    status!: CPU_Status
    sram_buffer!: ArrayBuffer
    sram!: DataView
    machine!: Machine
    mmu: number[] = []
    switches: number = 0

    constructor(options: CPU6Options) {
        super(options)
        this.sram_buffer = new ArrayBuffer(0x100) 
        this.sram = new DataView(this.sram_buffer)


    }

    init(machine: Machine) {
        this.machine = machine
        machine.loadROM("./roms/bootstrap_unscrambled.bin", 0x3FC00, 0x0200)
        this.reset()
    }

    reset() {
        this.status = {
            pc: 0,
            flags: 0,
            ipl: 0,
            mmu_base: 0,
            interrupt_enable: false,
            halt: false,
            dma: {
                addr: 0,
                count: 0,
                enabled: false,
                mode: 0
            },
            need_delay: false
        }
        
        // init mmu
        for(let j=0; j<8; j++) {
            for(let i=0; i<30; i++) {
                this.mmu[i+j*32] = i
            }
            this.mmu[30+j*32] = 0x7e
            this.mmu[31+j*32] = 0x7f
        }

        this.status.pc = 0xFC00
    }

    step(): boolean {
        super.step()
    
        if (this.status.need_delay) {
            this.status.need_delay = false
            return false
        }
    
        if (!this.status.halt) {
            const op = this.read_U8(this.status.pc)
    
            if (DEBUG) {
                DEBUG_clear()
                DEBUG_fetchCapturePC(this.status.pc)
                DEBUG_fetchCapture(op)
                DEBUG_PrintRegisters(this)
            }
            this.status.pc++
    
            //console.log(`DEBUG: ${addr.toString(16)}: op=${op.toString(16)}`)
            opcode_table[op >> 4](this, op & 0xF)
            if (DEBUG) DEBUG_PrintOp()
            return true
        }
        else {
            return false
        }
    }

    triggerInterrupt(interrupt: number) {
        if (this.status.interrupt_enable) {
            if (interrupt > this.status.ipl) {
                const prev_ipl = this.status.ipl
               
                this.register_write_U16(REG.P, this.status.pc)
    
                // save flags
                let C = this.register_read_U16(REG.C)
                C = (C & 0x0FFF) | this.status.flags << 12
                this.register_write_U16(REG.C, C)
    
                // change level
                this.status.ipl = interrupt
                if (DEBUG) {
                    DEBUG_Print("\nInterrupt Level = %d\n", interrupt)
                }
    
                // save previous IPL
                C = this.register_read_U16(REG.C)
                C = (C & 0xFF0F) | prev_ipl << 4
                this.register_write_U16(REG.C, C)
    
                // restore flags
                this.status.flags = (C >> 12) & 0xF
    
                // restore pc
                this.status.pc = this.register_read_U16(REG.P)
    
                this.status.halt = false
    
            }
        }
    }

    setMMUBase(base: number) {
        this.status.mmu_base = (base & 0x7) << 5
    }

    getMMUBase() {
        return this.status.mmu_base >> 5
    }

    setSwitches(switches: number) {
        this.switches = switches
    }

    read_U8(addr: number): number {
        if (addr < 0x100)
            return this.sram_read_U8(addr)
        return this.machine.read_U8(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF)
    }
    
    read_I8(addr: number): number {
        if (addr < 0x100)
            return this.sram_read_I8(addr)
        return this.machine.read_I8(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF)
    }
    
    read_U16(addr: number): number {
        if (addr < 0x100)
            return this.sram_read_U16(addr)
        return this.machine.read_U16(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF)
    }
    
    read_I16(addr: number): number {
        if (addr < 0x100)
            return this.sram_read_I16(addr)
        return this.machine.read_I16(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF)
    }
       
    write_U8(addr: number, value: number) {
        if (addr < 0x100)
            this.sram_write_U8(addr, value)   
        this.machine.write_U8(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF, value)
    }
    
    write_I8(addr: number, value: number) {
        if (addr < 0x100)
            this.sram_write_I8(addr, value)   
        this.machine.write_I8(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF, value)
    }
    
    write_U16(addr: number, value: number) {
        if (addr < 0x100)
            this.sram_write_U16(addr, value)   
        this.machine.write_U16(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF, value)
    }
    
    write_I16(addr: number, value: number) {
        if (addr < 0x100)
            this.sram_write_I16(addr, value)   
        this.machine.write_I16(this.mmu[addr >> 11 | this.status.mmu_base] << 11 | addr & 0x07FF, value)
    }    


    // SRAM read
    
    sram_read_U8(addr: number): number {
        if (DEBUG) {
    
        }
        return this.sram.getUint8(addr)
    }
    
    sram_read_I8(addr: number): number {
        return this.sram.getInt8(addr)
    }
    
    sram_read_U16(addr: number): number {
        if (addr & 1)
            return this.sram.getUint8(addr & 0xFE) << 8 | this.sram.getUint8(addr & 0xFE)
        return this.sram.getUint16(addr, false)
    }
    
    sram_read_I16(addr: number): number {
        if (addr & 1)
            return this.sram.getInt8(addr & 0xFE) << 8 | this.sram.getUint8(addr & 0xFE)
        return this.sram.getInt16(addr, false)
    }
    
    
    // SRAM write
    
    sram_write_U8(addr: number, value: number) {
        //if (DEBUG) DEBUG_Print("this.ram_write_U8(%04X, %02X)", addr, value)
        this.sram.setUint8(addr, value)
    }
    
    sram_write_I8(addr: number, value: number) {
        this.sram.setInt8(addr, value)
    }
    
    sram_write_U16(addr: number, value: number) {
        if (addr & 1) {
            this.sram.setUint8(addr & 0xFE, value >> 8)
            this.sram.setUint8(addr ^ 1, value)
        }
        else {
            this.sram.setUint16(addr, value, false)
        }
    }
    
    sram_write_I16(addr: number, value: number) {
        if (addr & 1) {
            this.sram.setUint8(addr & 0xFE, value >> 8)
            this.sram.setUint8(addr ^ 1, value)
        }
        else {
            this.sram.setInt16(addr, value, false)
        }
    }
    
    register_read_U16(reg: REG): number {
        return this.sram_read_U16(this.status.ipl << 4 | reg)
    }
    
    register_read_I16(reg: REG): number {
        return this.sram_read_I16(this.status.ipl << 4 | reg)
    }
    
    register_read_U8(reg: REGB): number {
        return this.sram_read_U8(this.status.ipl << 4 | reg)
    }
    
    register_read_I8(reg: REGB): number {
        return this.sram_read_I8(this.status.ipl << 4 | reg)
    }
    
    
    register_write_U16(reg: REG, value: number) {
        this.sram_write_U16(this.status.ipl << 4 | reg, value)
    }
    
    register_write_I16(reg: REG, value: number) {
        this.sram_write_I16(this.status.ipl << 4 | reg, value)
    }
    
    register_write_U8(reg: REGB, value: number) {
        this.sram_write_U8(this.status.ipl << 4 | reg, value)
    }
    
    register_write_I8(reg: REGB, value: number) {
        this.sram_write_I8(this.status.ipl << 4 | reg, value)
    }
    
    
    stack_push_U16(value: number) {
        let addr = this.register_read_U16(REG.S)
        addr -= 2
        this.write_U16(addr, value)
        this.register_write_U16(REG.S, addr)
    }
    
    stack_pop_U16() {
        let addr = this.register_read_U16(REG.S)
        let ret = this.read_U16(addr)
        addr += 2
        this.register_write_U16(REG.S, addr)
        return ret
    }
    
    stack_push_U8(value: number) {
        let addr = this.register_read_U16(REG.S)
        addr -= 1
        this.write_U8(addr, value)
        this.register_write_U16(REG.S, addr)
    }
    
    stack_pop_U8() {
        let addr = this.register_read_U16(REG.S)
        let ret = this.read_U8(addr)
        addr += 1
        this.register_write_U16(REG.S, addr)
        return ret
    }
}
