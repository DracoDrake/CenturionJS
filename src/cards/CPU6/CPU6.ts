/**
 * CPU6.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

import { DEBUG } from '../../Defines'
import { DEBUG_captureInstr, DEBUG_captureInstrBranch, DEBUG_captureInstrWithAM, DEBUG_clear, DEBUG_fetchCapture, DEBUG_fetchCaptureAddr, DEBUG_fetchCapturePC, DEBUG_Print, DEBUG_PrintHexDump, DEBUG_PrintMMU, DEBUG_PrintOp, DEBUG_PrintRegisters } from '../../Debug'

import {
    REGB, REG
} from '../CPU6Card'

import { table_branch } from './PreCalcTables'
import { AM_MODE_BYTE, AM_MODE_WORD, get_address } from './AddressingModes'

import { table_logic_byte, table_logic_word, table_math_mask, table_RL_byte, table_RR_byte, table_SL_byte, table_SR_byte } from './PreCalcTables'
import CPU6Card from '../CPU6Card'

export const FLAG_LINK = 1
export const FLAG_MINUS = 2
export const FLAG_FAULT = 4
export const FLAG_VALUE = 8

export const FLAG_LINK_BIT = 0
export const FLAG_MINUS_BIT = 1
export const FLAG_FAULT_BIT = 2
export const FLAG_VALUE_BIT = 3

export const opcode_table: Function[] = [
    opcode_0, opcode_1, opcode_2, opcode_3,
    opcode_4, opcode_5, opcode_6, opcode_7,
    opcode_8, opcode_9, opcode_a, opcode_b,
    opcode_c, opcode_d, opcode_e, opcode_f,
]

const opcode_0_table: Function[] = [
    op_HLT, op_NOP, op_SF, op_RF,
    op_EI, op_DI, op_SL, op_RL,
    op_CL, op_RSR, op_RI, op_RIM,
    op_ELO, op_PCX, op_DLY, op_RSYS
]

const opcode_2_table: Function[] = [
    op_INRB, op_DCRB, op_CLRB, op_IVRB,
    op_SRRB, op_SLRB, op_RRRB, op_RLRB,
    op_INAB, op_DCAB, op_CLAB, op_IVAB,
    op_SRAB, op_SLAB, opcode_MMU, opcode_DMA
]

const opcode_3_table: Function[] = [
    op_INR, op_DCR, op_CLR, op_IVR,
    op_SRR, op_SLR, op_RRR, op_RLR,
    op_INA, op_DCA, op_CLA, op_IVA,
    op_SRA, op_SLA, op_INX, op_DCX
]

const opcode_4_table: Function[] = [
    op_ADDB, op_SUBB, op_ANDB, op_ORIB,
    op_OREB, op_XFRB, op_NOP, opcode_BLOCK,
    op_AABB, op_SABB, op_NABB, op_XAXB,
    op_XAYB, op_XABB, op_NOP, op_NOP
]

const opcode_5_table: Function[] = [
    op_ADD, op_SUB, op_AND, op_ORI,
    op_ORE, op_XFR, op_NOP, op_NOP,
    op_AAB, op_SAB, op_NAB, op_XAX,
    op_XAY, op_XAB, op_XAZ, op_XAS
]

const opcode_6_table: Function[] = [
    op_LDX, op_LDX, op_LDX, op_LDX,
    op_LDX, op_LDX, op_JSYS, op_LDX,
    op_STX, op_STX, op_STX, op_STX,
    op_STX, op_STX, op_STX, op_STX
]

const opcode_7_table: Function[] = [
    op_JMP, op_JMP, op_JMP, op_JMP,
    op_JMP, op_JMP, op_SYSCALL, op_JMP,
    op_JSR, op_JSR, op_JSR, op_JSR,
    op_JSR, op_JSR, op_PUSH, op_POP
]

const opcode_DMA_table: Function[] = [
    op_STDMA, op_LDDMA, op_STDMAC, op_LDDMAC,
    op_DMAMODE, op_NOP, op_DMAENABLE, op_NOP,
    op_NOP, op_NOP, op_NOP, op_NOP,
    op_NOP, op_NOP, op_NOP, op_NOP
]


function fetchRegisters(cpu: CPU6Card) {
    const regs = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(regs)

    return [regs >> 4, regs & 0xF] as const
}


/**
 * Control Opcodes
 */
function opcode_0(cpu: CPU6Card, M: number) {
    opcode_0_table[M](cpu, M)
}

/**
 * Branch Opcodes
 */
function opcode_1(cpu: CPU6Card, M: number) {
    let addr = cpu.status.pc
    let rel = cpu.read_I8(cpu.status.pc++)
    if (DEBUG) {
        DEBUG_fetchCapture(rel)
        DEBUG_captureInstrBranch(cpu, M, rel)
    }
    cpu.status.pc += table_branch[cpu.status.flags << 8 | M << 4 | cpu.switches] * rel
}

function opcode_2(cpu: CPU6Card, M: number) {
    opcode_2_table[M](cpu, M)
}

function opcode_3(cpu: CPU6Card, M: number) {
    opcode_3_table[M](cpu, M)
}

function opcode_4(cpu: CPU6Card, M: number) {
    opcode_4_table[M](cpu, M)
}

function opcode_5(cpu: CPU6Card, M: number) {
    opcode_5_table[M](cpu, M)
}

function opcode_6(cpu: CPU6Card, M: number) {
    opcode_6_table[M](cpu, M)
}

function opcode_7(cpu: CPU6Card, M: number) {
    opcode_7_table[M](cpu, M)
}

function opcode_8(cpu: CPU6Card, M: number) {
    op_LDAB(cpu, M)
}

function opcode_9(cpu: CPU6Card, M: number) {
    op_LDA(cpu, M)
}

function opcode_a(cpu: CPU6Card, M: number) {
    op_STAB(cpu, M)
}

function opcode_b(cpu: CPU6Card, M: number) {
    op_STA(cpu, M)
}

function opcode_c(cpu: CPU6Card, M: number) {
    op_LDBB(cpu, M)
}

function opcode_d(cpu: CPU6Card, M: number) {
    op_LDB(cpu, M)
}

function opcode_e(cpu: CPU6Card, M: number) {
    op_STBB(cpu, M)
}

function opcode_f(cpu: CPU6Card, M: number) {
    op_STB(cpu, M)
}

function opcode_MMU(cpu: CPU6Card, M: number) {
    const MMUop = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(MMUop)
    if (MMUop == 0x0c)
        op_LDMMU(cpu, M)
    else if (MMUop == 0x1c)
        op_STMMU(cpu, M)
}

function opcode_DMA(cpu: CPU6Card, M: number) {
    const DMAop = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(DMAop)
    opcode_DMA_table[DMAop & 0xF](cpu, DMAop >> 4)
}

function opcode_BLOCK(cpu: CPU6Card, M: number) {
    const BLOCKop = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(BLOCKop)
    if (BLOCKop == 0x40)
        op_BCP(cpu)
    else if (BLOCKop == 0x80)
        op_BCMP(cpu)
}


/******************************************/

/**
 * Load cpu.mmu
 */
function op_LDMMU(cpu: CPU6Card, M: number) {
    let bank = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(bank)
    const bankn = bank & 7
    let addr = cpu.read_U16(cpu.status.pc)
    if (DEBUG) DEBUG_fetchCapture(addr, 2)
    cpu.status.pc += 2

    if (DEBUG) DEBUG_captureInstr("LDMMU %d (%04X)", bankn, addr)

    if (DEBUG) {
        if (bankn < 0 || bankn > 7) {
            throw new Error(`Invalid Bank ${bankn}`)
        }
    }

    for (let i = 0; i < 32; i++) {
        const value = cpu.read_U8(addr + i)
        if (value === undefined) {
            DEBUG_Print("LDMMU value undefined: bank=%d, i=%d\n", bankn, i)
            process.exit(2)
        }
        // if (cpu.status.ipl > 0)
        //     DEBUG_Print("LDMMU bank=%02X mmuidx=%02X addr=%04X value=%02X\n", bank, (bankn << 5 | i), addr + i, value)
        cpu.mmu[bankn << 5 | i] = value
    }

    // if (DEBUG) {
    //     DEBUG_PrintMMU(cpu)
    // }
}

/**
 * Store mmu
 */
function op_STMMU(cpu: CPU6Card, M: number) {
    let bank = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) DEBUG_fetchCapture(bank)
    const bankn = bank & 7
    let addr = cpu.read_U16(cpu.status.pc)
    if (DEBUG) DEBUG_fetchCapture(addr, 2)
    cpu.status.pc += 2

    if (DEBUG) DEBUG_captureInstr("STMMU %d (%04X)", bankn, addr)

    if (DEBUG) {
        if (bankn < 0 || bankn > 7) {
            throw new Error(`Invalid Bank ${bankn}`)
        }
    }

    for (let i = 0; i < 32; i++) {
        const value = cpu.mmu[bankn << 5 | i]
        if (value === undefined) {
            DEBUG_Print("STMMU value undefined: bank=%d, i=%d\n", bankn, i)
            process.exit(2)
        }
        // if (cpu.status.ipl > 0)
        //     DEBUG_Print("STMMU bank=%02X mmuidx=%02X addr=%04X value=%02X\n", bank, (bankn << 5 | i), addr + i, value)
        cpu.write_U8(addr + i, value)
    }
}


/**
 * Load DMA
 */
function op_LDDMA(cpu: CPU6Card, reg: REG) {
    if (DEBUG) DEBUG_captureInstr("LDDMA %s", REG[reg])
    cpu.register_write_U16(reg, cpu.status.dma.addr)
}

/**
 * Store DMA
 */
function op_STDMA(cpu: CPU6Card, reg: REG) {
    if (DEBUG) DEBUG_captureInstr("STDMA %s", REG[reg])
    cpu.status.dma.addr = cpu.register_read_U16(reg)
}

/**
 * Load DMA count
 */
function op_LDDMAC(cpu: CPU6Card, reg: REG) {
    if (DEBUG) DEBUG_captureInstr("LDDMAC %s", REG[reg])
    cpu.register_write_U16(reg, cpu.status.dma.count)
}

/**
 * Store DMA count
 */
function op_STDMAC(cpu: CPU6Card, reg: REG) {
    if (DEBUG) DEBUG_captureInstr("STDMAC %s", REG[reg])
    cpu.status.dma.count = cpu.register_read_U16(reg)
}

/**
 * Set DMA mode
 */
function op_DMAMODE(cpu: CPU6Card, mode: number) {
    if (DEBUG) DEBUG_captureInstr("DMAMODE %d", mode)
    cpu.status.dma.mode = mode
}

/**
 * Enable DMA
 */
function op_DMAENABLE(cpu: CPU6Card, reg: REG) {
    if (DEBUG) DEBUG_captureInstr("DMAENABLE %s", REG[reg])
    cpu.status.dma.enabled = true
}

/**
 * Block copy
 */
function op_BCP(cpu: CPU6Card) {
    const len = cpu.read_U8(cpu.status.pc++)
    const src_addr = cpu.read_U16(cpu.status.pc)
    cpu.status.pc += 2
    const dest_addr = cpu.read_U16(cpu.status.pc)
    cpu.status.pc += 2
    if (DEBUG) {
        DEBUG_fetchCapture(len)
        DEBUG_fetchCapture(src_addr, 2)
        DEBUG_fetchCapture(dest_addr, 2)
        DEBUG_captureInstr("BCP %04X, (%04X), (%04X)", len, src_addr, dest_addr)
    }

    //if ((dest_addr + len) < 0x10000 && (src_addr + len) < 0x10000) {
    for (let i = 0; i < len; i++) {
        cpu.write_U8(dest_addr + i, cpu.read_U8(src_addr + i))
    }
    //}
}

/**
 * Block compare
 */
function op_BCMP(cpu: CPU6Card) {
    const len = cpu.read_U8(cpu.status.pc++)
    const src_addr = cpu.read_U16(cpu.status.pc)
    cpu.status.pc += 2
    const dest_addr = cpu.read_U16(cpu.status.pc)
    cpu.status.pc += 2
    if (DEBUG) {
        DEBUG_fetchCapture(len)
        DEBUG_fetchCapture(src_addr, 2)
        DEBUG_fetchCapture(dest_addr, 2)
        DEBUG_captureInstr("BCMP %04X, (%04X), (%04X)", len, src_addr, dest_addr)
    }

    //    if ((dest_addr + len) < 0x10000 && (src_addr + len) < 0x10000) {
    let equal = true
    for (let i = 0; i < len; i++) {
        const src = cpu.read_U8(src_addr + i)
        const dest = cpu.read_U8(dest_addr + i)
        if (src != dest)
            equal = false
    }
    cpu.status.flags = (cpu.status.flags & 0xF7) | +equal << FLAG_VALUE_BIT
    // }
    // else {
    //     cpu.status.flags = (cpu.status.flags & 0xF7)
    // }
}


/**
 * 
 */
function op_SYSCALL(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SYSCALL")
    cpu.triggerInterrupt(15)
}

/**
 * 
 */
 function op_POP(cpu: CPU6Card, M: number) {
    const [start_register, count] = fetchRegisters(cpu)
    if (DEBUG) {
        DEBUG_captureInstr("POP %s, %s", REGB[start_register], count + 1)
    }

    const end_register = start_register + count

    for(let i=end_register; i>=start_register; i--) {
        if (i % 16 == REGB.SH || i % 16 == REGB.SL) {
            cpu.stack_pop_U8()
            continue
        }
        cpu.register_write_U8(i % 16, cpu.stack_pop_U8())
    }
}

/**
 * 
 */
function op_PUSH(cpu: CPU6Card, M: number) {
    const [start_register, count] = fetchRegisters(cpu)
    if (DEBUG) {
        DEBUG_captureInstr("PUSH %s, %d", REGB[start_register], count + 1)
    }

    const SH = cpu.register_read_U8(REGB.SH)
    const SL = cpu.register_read_U8(REGB.SL)

    const end_register = start_register + count + 1

    for(let i=start_register; i<end_register; i++) {
        if (i % 16 == REGB.SH) {
            cpu.stack_push_U8(SH)
            continue
        }
        if (i % 16 == REGB.SL) {
            cpu.stack_push_U8(SL)
            continue
        }
        cpu.stack_push_U8(cpu.register_read_U8(i % 16))
    }
}

// /**
//  * 
//  */
// function op_POP(cpu: CPU6Card, M: number) {
//     const something = cpu.read_U8(cpu.status.pc++)
//     if (DEBUG) {
//         DEBUG_fetchCapture(something)
//         DEBUG_captureInstr("POP %s, %s", REGB[something >> 4], REGB[something & 0xF])
//     }

//     cpu.register_write_U8(something & 0xF, cpu.stack_pop_U8())
//     cpu.register_write_U8(something >> 4, cpu.stack_pop_U8())
// }

// /**
//  * 
//  */
// function op_PUSH(cpu: CPU6Card, M: number) {
//     const something = cpu.read_U8(cpu.status.pc++)
//     if (DEBUG) {
//         DEBUG_fetchCapture(something)
//         DEBUG_captureInstr("PUSH %s, %s", REGB[something >> 4], REGB[something & 0xF])
//     }

//     cpu.stack_push_U8(cpu.register_read_U8(something >> 4))
//     cpu.stack_push_U8(cpu.register_read_U8(something & 0xF))
// }

/**
 * Return from interrupt
 */
 function op_RI(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("RI")
    // save pc
    cpu.register_write_U16(REG.P, cpu.status.pc)

    // get previous ipl
    let C = cpu.register_read_U16(REG.C)
    const prev_ipl = (C >> 4) & 0xF

    // save flags
    C = (C & 0x0FFF) | cpu.status.flags << 12
    cpu.register_write_U16(REG.C, C)

    // change to previous ipl
    cpu.status.ipl = prev_ipl
    if (DEBUG) {
        DEBUG_Print("\nInterrupt Level = %d\n", prev_ipl)
    }

    // restore flags
    C = cpu.register_read_U16(REG.C)
    cpu.status.flags = (C >> 12) & 0xF

    // restore pc
    cpu.status.pc = cpu.register_read_U16(REG.P)
}


/**
 * Return from Interrupt Modified
 */
function op_RIM(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("RIM")

    // get previous ipl
    let C = cpu.register_read_U16(REG.C)
    const prev_ipl = (C >> 4) & 0xF

    // save flags
    C = (C & 0x0FFF) | cpu.status.flags << 12
    cpu.register_write_U16(REG.C, C)

    // change to previous ipl
    cpu.status.ipl = prev_ipl
    if (DEBUG) {
        DEBUG_Print("\nInterrupt Level = %d\n", prev_ipl)
    }

    // restore flags
    C = cpu.register_read_U16(REG.C)
    cpu.status.flags = (C >> 12) & 0xF

    // restore pc
    cpu.status.pc = cpu.register_read_U16(REG.P)
}

function op_RSYS(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("RSYS")
    const argument = cpu.stack_pop_U8()
    const new_x = cpu.stack_pop_U16()
    const new_ipl = cpu.stack_pop_U8()
    const new_mmu_bank = cpu.stack_pop_U8()
    const X = cpu.register_read_U16(REG.X)

    cpu.setMMUBase(new_mmu_bank)
    cpu.status.ipl = new_ipl & 0xF
    cpu.register_write_U16(REG.X, new_x)

    cpu.status.pc = X
}

// /**
//  * Return from JSYS using stack. (pops a byte, PC <- X, then pops the new value of X, then the new IPL, then the new Page Table Base). See also JSYS
//  */
//  function op_RSYS(cpu: CPU6Card, M: number) {
//     // DEBUG_Print("Before RSYS:\n")

//     // let data: number[] = []
//     // // for(let i=0; i<0x400; i++)
//     // //     data.push(cpu.read_U8(i))
//     // // DEBUG_PrintHexDump(data, 0x400)

//     // data = []
//     // for(let i=0; i<0xC000; i++)
//     //     data.push(cpu.read_U8(i))
//     // DEBUG_PrintHexDump(data, 0xC000, 0xBF00)    

//     if (DEBUG) DEBUG_captureInstr("RSYS")
//     const argument = cpu.stack_pop_U8()
//     const new_x = cpu.stack_pop_U16()
//     const new_ipl = cpu.stack_pop_U8()
//     const new_mmu_bank = cpu.stack_pop_U8()

//     const X = cpu.register_read_U16(REG.X)
//     const Z = cpu.register_read_U16(REG.Z)


//     const current_base_index = cpu.status.pc >> 11
//     const current_mmu_bank = cpu.getMMUBase()
//     const current_page = cpu.mmu[current_mmu_bank << 5 | current_base_index]

//     DEBUG_Print("\nNEW_X=%04X, NEW_IPL=%02X, NEW_MMU_BANK=%02X, X=%04X, Z=%04X, current_base_index=%04X, current_mmu_bank=%02X, current_page=%02X\n",
//     new_x, new_ipl, new_mmu_bank, X, Z, current_base_index, current_mmu_bank, current_page)


//     // find page in new mmu bank
//     let new_base_index = -1
//     for(let index = 0; index < 0x20; index++) {
//         if (cpu.mmu[new_mmu_bank << 5 | index] == current_page) {
//             new_base_index = index
//             break
//         }
//     }

//     DEBUG_Print("new_base_index=%02X\n", new_base_index)


//     if (new_base_index >= 0) {
//         // change MMU bank
//         cpu.setMMUBase(new_mmu_bank)
    
//         // get new base address
//         const new_base_address = new_base_index << 11
        
//         // add X, sub Z
//         const new_addr = new_base_address + X - Z

//         DEBUG_Print("new_base_address=%04X, new_addr=%04X\n", new_base_index, new_addr)

//         // set PC
//         cpu.status.pc = new_addr

//         // change IL
//         cpu.status.ipl = new_ipl & 0xF

//         cpu.register_write_U16(REG.X, new_x)
//         //cpu.register_write_U16(REG.Z, new_base_address)
//     }
//     else {
//         // Could not find address
//         DEBUG_Print("Could not find address\n")
//     }

// }

function op_JSYS(cpu: CPU6Card, M: number) {
    const argument = cpu.read_U8(cpu.status.pc++)
    if (DEBUG) {
        DEBUG_fetchCapture(argument)
        DEBUG_captureInstr("JSYS %02X", argument)
    }
    cpu.stack_push_U8(cpu.getMMUBase())
    cpu.stack_push_U8(cpu.status.ipl)
    cpu.stack_push_U16(cpu.register_read_U16(REG.X))
    cpu.register_write_U16(REG.X, cpu.status.pc)
    cpu.stack_push_U8(argument)

    cpu.setMMUBase(0)

    cpu.status.pc = 0x100
}


/**
 * Halts the CPU
 */
function op_HLT(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("HLT")
    cpu.register_write_U16(REG.P, cpu.status.pc)
    cpu.status.halt = true
    process.stdout.write("Halted CPU\n")

    if (DEBUG) {
        DEBUG_PrintMMU(cpu)
        DEBUG_Print("Memory:\n")

        let data: number[] = []
        // for(let i=0; i<0x400; i++)
        //     data.push(cpu.read_U8(i))
        // DEBUG_PrintHexDump(data, 0x400)

        data = []
        for(let i=0; i<0xC000; i++)
            data.push(cpu.read_U8(i))
        DEBUG_PrintHexDump(data, 0xC000, 0xBF00)
    }
    process.exit(1)
}


/**
 * No Operation
 */
function op_NOP(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("NOP")
}


/**
 * Set Fault
 */
function op_SF(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SF")
    cpu.status.flags |= FLAG_FAULT
}


/**
 * Reset Fault
 */
function op_RF(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("RF")
    cpu.status.flags &= ~FLAG_FAULT
}


/**
 * Enable the Interrupt System
 */
function op_EI(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("EI")
    cpu.status.interrupt_enable = true
}


/**
 * Disable the Interrupt System
 */
function op_DI(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("DI")
    cpu.status.interrupt_enable = false
}


/**
 * Set the Link/carry Flag
 */
function op_SL(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SL")
    cpu.status.flags |= FLAG_LINK
}


/**
 * Reset the Link/carry Flag
 */
function op_RL(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("RL")
    cpu.status.flags &= ~FLAG_LINK
}


/**
 * Complement Link
 */
function op_CL(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("CL")
    cpu.status.flags ^= FLAG_LINK
}


/**
 * Return from subroutine
 */
function op_RSR(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("RSR")
    cpu.status.pc = cpu.register_read_U16(REG.X)
    cpu.register_write_U16(REG.X, cpu.stack_pop_U16())
}





/**
 * Enable Link Out
 */
function op_ELO(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("ELO")

}


/**
 * Transfer PC to X
 */
function op_PCX(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("PCX")
    cpu.register_write_U16(REG.X, cpu.status.pc)
}


/**
 * Delay 4.5 ms
 */
function op_DLY(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("DLY")
    // sleep
}






/**
 * Increment byte of explicit register
 */
function op_INRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("INRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("INRB %s", REGB[sr])
    }
    const value = cpu.register_read_U8(sr)
    const result = (value + count + 1) & 0xFF
    cpu.register_write_U8(sr, result);
    cpu.status.flags = (cpu.status.flags & 0xF1) | table_logic_byte.flags[result & 0xFF]
    // if (result & 0x80) {
    //     if (!((value | (count+1)) & 0x80))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (count+1) & 0x80)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result >= 0x100)
    //     cpu.status.flags |= FLAG_LINK
}


/**
 * Decrement byte of explicit register
 */
function op_DCRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("DCRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("DCRB %s", REGB[sr])
    }
    const value = cpu.register_read_U8(sr)
    const result = (value - (count + 1)) & 0xFF
    cpu.register_write_U8(sr, result);
    cpu.status.flags = table_logic_byte.flags[result & 0xFF]
}


/**
 * Clear byte of explicit register (22 32 = CPU ID)
 */
function op_CLRB(cpu: CPU6Card, M: number) {
    const [sr, value] = fetchRegisters(cpu)
    if (DEBUG) {
        if (value > 0)
            DEBUG_captureInstr("CLRB %s, %d", REGB[sr], value)
        else
            DEBUG_captureInstr("CLRB %s", REGB[sr])
    }
    cpu.register_write_U8(sr, value)
    cpu.status.flags = table_logic_byte.flags[value]
    // if (sr == REGB.BL && value == 2)
    //     cpu.status.flags |= FLAG_VALUE
}


/**
 * Invert byte of explicit register
 */
function op_IVRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("IVRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("IVRB %s", REGB[sr])
    }
    const value = cpu.register_read_U8(sr) ^ 0xFF
    cpu.register_write_U8(sr, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Shift byte of explicit register right
 */
function op_SRRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SRRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("SRRB %s", REGB[sr])
    }
    const value = cpu.register_read_U8(sr)
    cpu.register_write_U8(sr, table_SR_byte.data[value][count])
    cpu.status.flags = (cpu.status.flags & table_SR_byte.mask) | table_SR_byte.flags[value][count]
}


/**
 * Shift byte of explicit register left
 */
function op_SLRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SLRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("SLRB %s", REGB[sr])
    }
    const value = cpu.register_read_U8(sr)
    cpu.register_write_U8(sr, table_SL_byte.data[value][count])
    cpu.status.flags = (cpu.status.flags & table_SL_byte.mask) | table_SL_byte.flags[value][count]
}


/**
 * Rotate byte of explicit register right (wraps through carry)
 */
function op_RRRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RRRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("RRRB %s", REGB[sr])
    }
    const L = cpu.status.flags & FLAG_LINK
    const value = cpu.register_read_U8(sr)
    cpu.register_write_U8(sr, table_RR_byte.data[value][count][L])
    cpu.status.flags = (cpu.status.flags & table_RR_byte.mask) | table_RR_byte.flags[value][count][L]
}


/**
 * Rotate byte of explicit register left (wraps through carry)
 */
function op_RLRB(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RLRB %s, %d", REGB[sr], count + 1)
        else
            DEBUG_captureInstr("RLRB %s", REGB[sr])
    }
    const L = cpu.status.flags & FLAG_LINK
    const value = cpu.register_read_U8(sr)
    cpu.register_write_U8(sr, table_RL_byte.data[value][count][L])
    cpu.status.flags = (cpu.status.flags & table_RL_byte.mask) | table_RL_byte.flags[value][count][L]
}


/**
 * Increment byte of implicit AL register
 */
function op_INAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("INAB")
    const value = cpu.register_read_U8(REGB.AL)
    const result = value + 1
    cpu.register_write_U8(REGB.AL, result)
    cpu.status.flags = (cpu.status.flags & 0xF1) | table_logic_word.flags[result & 0xFF]
    // if (result & 0x80) {
    //     if (!((value | (1)) & 0x80))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (1) & 0x80)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x100)
    //     cpu.status.flags |= FLAG_LINK
}


/**
 * Decrement byte of implicit AL register
 */
function op_DCAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("DCAB")
    const value = cpu.register_read_U8(REGB.AL)
    const result = value - 1
    cpu.register_write_U8(REGB.AL, result)
    cpu.status.flags = table_logic_byte.flags[result]
}


/**
 * Clear byte of implicit AL register
 */
function op_CLAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("CLAB")
    const value = 0
    cpu.register_write_U8(REGB.AL, value)
    cpu.status.flags = FLAG_VALUE
}


/**
 * Invert byte of implicit AL register
 */
function op_IVAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("IVAB")
    const value = cpu.register_read_U8(REGB.AL) ^ 0xFF
    cpu.register_write_U8(REGB.AL, value);
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Shift byte of implicit AL register left
 */
function op_SRAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SRAB")
    const value = cpu.register_read_U8(REGB.AL)
    cpu.register_write_U8(REGB.AL, table_SR_byte.data[value][0])
    cpu.status.flags = (cpu.status.flags & table_SR_byte.mask) | table_SR_byte.flags[value][0]
}


/**
 * Shift byte of implicit AL register right
 */
function op_SLAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SLAB")
    const value = cpu.register_read_U8(REGB.AL)
    cpu.register_write_U8(REGB.AL, table_SL_byte.data[value][0])
    cpu.status.flags = (cpu.status.flags & table_SL_byte.mask) | table_SL_byte.flags[value][0]
}


/**
 * Increment word of explicit register
 */
function op_INR(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("INR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("INR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr)
    const result = value + count + 1
    cpu.register_write_U16(sr, result)
    // if (cpu.status.pc == 0x89B8) {
    //     DEBUG_Print("count=%d, value=%d, result=%d", count, value, result)
    // }
    cpu.status.flags = (cpu.status.flags & 0xF1) | table_logic_word.flags[result & 0xFFFF]
    // if (result & 0x8000) {
    //     cpu.status.flags |= +(!((value | (count+1)) & 0x8000)) << FLAG_FAULT_BIT
    // } else {
    //     cpu.status.flags |= +(value & (count+1) & 0x8000) << FLAG_FAULT_BIT
    // }
	// if (result >= 0x10000)
    //     cpu.status.flags |= FLAG_LINK

}


/**
 * Decrement word of explicit register
 */
function op_DCR(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("DCR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("DCR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr)
    const result = value - (count + 1)
    cpu.register_write_U16(sr, result)
    cpu.status.flags = table_logic_word.flags[result & 0xFFFF]
}


/**
 * Clear word of explicit register (22 32 = CPU ID)
 */
function op_CLR(cpu: CPU6Card, M: number) {
    const [sr, value] = fetchRegisters(cpu)
    if (DEBUG) {
        if (value > 0)
            DEBUG_captureInstr("CLR %s, %d", REG[sr], value)
        else
            DEBUG_captureInstr("CLR %s", REG[sr])
    }
    cpu.register_write_U16(sr, value)
    cpu.status.flags = table_logic_word.flags[value]
}


/**
 * Invert word of explicit register
 */
function op_IVR(cpu: CPU6Card, M: number) {
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("IVR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("IVR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr) ^ 0xFFFF
    cpu.register_write_U16(sr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Shift word of explicit register right
 */
function op_SRR(cpu: CPU6Card, M: number) {
    let v, r
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SRR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("SRR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr)

    r = ((value << 16) >> 16) >> count
    v = r >> 1

    cpu.register_write_U16(sr, v & 0xFFFF)

    cpu.status.flags &= 0xF4
    if (v < 0)
        cpu.status.flags |= FLAG_MINUS
    if (v == 0)
        cpu.status.flags |= FLAG_VALUE
    if (r & 1)
        cpu.status.flags |= FLAG_LINK
}


/**
 * Shift word of explicit register left
 */
function op_SLR(cpu: CPU6Card, M: number) {
    let v, r
    const [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("SLR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("SLR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr)

    r = (value << count) & 0xFFFF
    v = (r << 1) & 0xFFFF

    cpu.register_write_U16(sr, v)

    cpu.status.flags = 0
    if (v > 0x7FFF)
        cpu.status.flags |= FLAG_MINUS
    if (v == 0)
        cpu.status.flags |= FLAG_VALUE
    if (r > 0x7FFF)
        cpu.status.flags |= FLAG_LINK
    if (v > 0x7FFF !== r > 0x7FFF)
        cpu.status.flags |= FLAG_FAULT
}


/**
 * Rotate word of explicit register right (wraps through carry)
 */
function op_RRR(cpu: CPU6Card, M: number) {
    let v, r
    let [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RRR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("RRR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr)

    count++
    r = value | (cpu.status.flags & FLAG_LINK) << 16
    v = ((r >> count) | (r << (17 - count))) & 0x1FFFF

    cpu.register_write_U16(sr, v & 0xFFFF)

    cpu.status.flags &= 0xF4
    if (v & 0x8000)
        cpu.status.flags |= FLAG_MINUS
    if ((v & 0xFFFF) == 0)
        cpu.status.flags |= FLAG_VALUE
    if (v & 0x10000)
        cpu.status.flags |= FLAG_LINK
}


/**
 * Rotate word of explicit register left (wraps through carry)
 */
function op_RLR(cpu: CPU6Card, M: number) {
    let v, r
    let [sr, count] = fetchRegisters(cpu)
    if (DEBUG) {
        if (count > 0)
            DEBUG_captureInstr("RLR %s, %d", REG[sr], count + 1)
        else
            DEBUG_captureInstr("RLR %s", REG[sr])
    }
    const value = cpu.register_read_U16(sr)

    count++
    r = value | (cpu.status.flags & FLAG_LINK) << 16
    v = ((r << count) | (r >> (17 - count))) & 0x1FFFF

    cpu.register_write_U16(sr, v & 0xFFFF)

    cpu.status.flags = 0
    if (v & 0x8000)
        cpu.status.flags |= FLAG_MINUS
    if ((v & 0xFFFF) == 0)
        cpu.status.flags |= FLAG_VALUE
    if (v & 0x10000)
        cpu.status.flags |= FLAG_LINK
    if (((v >> 1) ^ v) & 0x8000)
        cpu.status.flags |= FLAG_FAULT
}


/**
 * Increment word of implicit A register
 */
function op_INA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("INA")
    const value = cpu.register_read_U16(REG.A)
    const result = value + 1
    cpu.register_write_U16(REG.A, result)
    cpu.status.flags = (cpu.status.flags & 0xF1) | table_logic_word.flags[result & 0xFFFF]
    // if (result & 0x8000) {
    //     if (!((value | (1)) & 0x8000))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (1) & 0x8000)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     cpu.status.flags |= FLAG_LINK

}


/**
 * Decrement word of implicit A register
 */
function op_DCA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("DCA")
    const value = cpu.register_read_U16(REG.A)
    const result = value - 1
    cpu.register_write_U16(REG.A, result)
    cpu.status.flags = table_logic_word.flags[result]
}


/**
 * Clear word of implicit A register
 */
function op_CLA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("CLA")
    cpu.register_write_U16(REG.A, 0)
    cpu.status.flags = FLAG_VALUE
}


/**
 * Invert word of implicit A register
 */
function op_IVA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("IVA")
    const value = cpu.register_read_U16(REG.A) ^ 0xFFFF
    cpu.register_write_U16(REG.A, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Shift word of implicit A register left
 */
function op_SRA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SRA")
    let v, r
    const value = cpu.register_read_U16(REG.A)

    r = (value << 16) >> 16
    v = r >> 1

    cpu.register_write_U16(REG.A, v & 0xFFFF)

    cpu.status.flags &= 0xF4
    if (v < 0)
        cpu.status.flags |= FLAG_MINUS
    if (v == 0)
        cpu.status.flags |= FLAG_VALUE
    if (r & 1)
        cpu.status.flags |= FLAG_LINK
}


/**
 * Shift word of implicit A register right
 */
function op_SLA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SLA")
    const value = cpu.register_read_U16(REG.A)

    const v = (value << 1) & 0xFFFF

    cpu.register_write_U16(REG.A, v)

    cpu.status.flags =
        +(v == 0) << FLAG_VALUE_BIT |
        +(v > 0x7FFF) << FLAG_MINUS_BIT |
        +(value > 0x7FFF) << FLAG_LINK_BIT |
        +(v > 0x7FFF !== value > 0x7FFF) << FLAG_FAULT_BIT
}


/**
 * Increment word of implicit X register
 */
function op_INX(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("INX")
    const value = cpu.register_read_U16(REG.X)
    const result = value + 1
    cpu.register_write_U16(REG.X, result)
    cpu.status.flags = (cpu.status.flags & 0xF1) | table_logic_word.flags[result & 0xFFFF]
    // if (result & 0x8000) {
    //     if (!((value | (1)) & 0x8000))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (value & (1) & 0x8000)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     cpu.status.flags |= FLAG_LINK
}


/**
 * Decrement word of implicit X register
 */
function op_DCX(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("DCX")
    const value = cpu.register_read_U16(REG.X)
    const result = value - 1
    cpu.register_write_U16(REG.X, result)
    cpu.status.flags = table_logic_word.flags[result & 0xFFFF]
}


/**
 * Add bytes of two explicit registers (left plus right stored in left)
 */
function op_ADDB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("ADDB %s, %s", REGB[sr], REGB[dr])
    const dvalue = cpu.register_read_U8(dr)
    const svalue = cpu.register_read_U8(sr)
    const result = svalue + dvalue
    cpu.register_write_U8(dr, result)
    cpu.status.flags = table_logic_byte.flags[result & 0xFF] |
        +((result & 0x100) != 0) << FLAG_LINK_BIT


    // if (result & 0x80) {
    //     if (!((svalue | dvalue) & 0x80))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x80)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x100)
    //     cpu.status.flags |= FLAG_LINK
}

/**
 * Subtract bytes of two explicit registers (left minus right stored in left)
 */
function op_SUBB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("SUBB %s, %s", REGB[sr], REGB[dr])
    const svalue = cpu.register_read_I8(sr)
    const dvalue = cpu.register_read_I8(dr)
    const result = svalue - dvalue
    cpu.register_write_I8(dr, result);
    cpu.status.flags = table_logic_byte.flags[result & 0xFF] |
        +(svalue < 0 !== (dvalue < 0 && result <= 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (svalue & 0x80) {
    //     if (!((dvalue | result) & 0x80))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (dvalue & result & 0x80)
    //         cpu.status.flags |= FLAG_FAULT
    // }
    // cpu.status.flags |= +((dvalue & 0xFFFFF) <= (svalue & 0xFFFFF)) << FLAG_LINK_BIT
}


/**
 * AND bytes of two explicit registers (left AND right stored in left)
 */
function op_ANDB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("ANDB %s, %s", REGB[sr], REGB[dr])
    const value = cpu.register_read_U8(sr) & cpu.register_read_U8(dr)
    cpu.register_write_U8(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * OR bytes of two explicit registers (left OR right stored in left)
 */
function op_ORIB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("ORIB %s, %s", REGB[sr], REGB[dr])
    const value = cpu.register_read_U8(sr) | cpu.register_read_U8(dr)
    cpu.register_write_U8(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * XOR bytes of two explicit registers (left XOR right stored in left)
 */
function op_OREB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("OREB %s, %s", REGB[sr], REGB[dr])
    const value = cpu.register_read_U8(sr) ^ cpu.register_read_U8(dr)
    cpu.register_write_U8(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Copy byte of one explicit register into other explicit register (right into left)
 */
function op_XFRB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("XFRB %s, %s", REGB[sr], REGB[dr])
    const value = cpu.register_read_U8(sr)
    cpu.register_write_U8(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Add bytes of implicit AL and BL (AL plus BL stored in BL)
 */
function op_AABB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("AABB")
    const dvalue = cpu.register_read_U8(REGB.BL)
    const svalue = cpu.register_read_U8(REGB.AL)
    const result = dvalue + svalue
    cpu.register_write_U8(REGB.BL, result);
    cpu.status.flags = table_logic_byte.flags[result & 0xFF] |
        +((result & 0x100) != 0) << FLAG_LINK_BIT


    // if (result & 0x80) {
    //     if (!((svalue | dvalue) & 0x80))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x80)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x100)
    //     cpu.status.flags |= FLAG_LINK
}


/**
 * Subtract bytes of implicit AL and BL (AL minus BL stored in BL)
 */
function op_SABB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SABB")
    const dvalue = cpu.register_read_I8(REGB.BL)
    const svalue = cpu.register_read_I8(REGB.AL)
    const result = svalue - dvalue
    cpu.register_write_I8(REGB.BL, result)
    cpu.status.flags = table_logic_byte.flags[result & 0xFF] |
        +(svalue < 0 !== (dvalue < 0 && result <= 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (svalue & 0x80) {
    //     if (!((dvalue | result) & 0x80))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (dvalue & result & 0x80)
    //         cpu.status.flags |= FLAG_FAULT
    // }
    // cpu.status.flags |= +((dvalue & 0xFFFFF) <= (svalue & 0xFFFFF)) << FLAG_LINK_BIT
}


/**
 * AND bytes of implicit AL and BL (AL AND BL stored in BL)
 */
function op_NABB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("NABB")
    const value = cpu.register_read_I8(REGB.AL) & cpu.register_read_I8(REGB.BL)
    cpu.register_write_I8(REGB.BL, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Transfer byte of implicit AL into XL
 */
function op_XAXB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAXB")
    const value = cpu.register_read_U8(REGB.AL)
    cpu.register_write_U8(REGB.XL, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Transfer byte of implicit AL into YL
 */
function op_XAYB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAYB")
    const value = cpu.register_read_U8(REGB.AL)
    cpu.register_write_U8(REGB.YL, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Transfer byte of implicit AL into BL
 */
function op_XABB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XABB")
    const value = cpu.register_read_U8(REGB.AL)
    cpu.register_write_U8(REGB.BL, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Load X
 */
function op_LDX(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "LDX", M & 7, AM_MODE_WORD)
    const value = cpu.read_U16(get_address(cpu, M & 7, AM_MODE_WORD))
    cpu.register_write_U16(REG.X, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Load A
 */
function op_LDA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "LDA", M, AM_MODE_WORD)
    const addr = get_address(cpu, M, AM_MODE_WORD)
    const value = cpu.read_U16(addr)
    cpu.register_write_U16(REG.A, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Load AL
 */
function op_LDAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "LDAB", M, AM_MODE_BYTE)
    const value = cpu.read_U8(get_address(cpu, M, AM_MODE_BYTE))
    cpu.register_write_U8(REGB.AL, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}

/**
 * Load B
 */
function op_LDB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "LDB", M, AM_MODE_WORD)
    const value = cpu.read_U16(get_address(cpu, M, AM_MODE_WORD))
    cpu.register_write_U16(REG.B, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Load BL
 */
function op_LDBB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "LDBB", M, AM_MODE_BYTE)
    const value = cpu.read_U8(get_address(cpu, M, AM_MODE_BYTE))
    cpu.register_write_U8(REGB.BL, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}

/**
 * Store AL
 */
function op_STAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "STAB", M, AM_MODE_BYTE)
    const value = cpu.register_read_U8(REGB.AL)
    const addr = get_address(cpu, M, AM_MODE_BYTE)
    cpu.write_U8(addr, value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}

/**
 * Store A
 */
function op_STA(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "STA", M, AM_MODE_WORD)
    const value = cpu.register_read_U16(REG.A)
    cpu.write_U16(get_address(cpu, M, AM_MODE_WORD), value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Store X
 */
function op_STX(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "STX", M & 7, AM_MODE_WORD)
    const value = cpu.register_read_U16(REG.X)
    cpu.write_U16(get_address(cpu, M & 7, AM_MODE_WORD), value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Store B
 */
function op_STB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "STB", M, AM_MODE_WORD)
    const value = cpu.register_read_U16(REG.B)
    cpu.write_U16(get_address(cpu, M, AM_MODE_WORD), value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Store B
 */
function op_STBB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "STBB", M, AM_MODE_BYTE)
    const value = cpu.register_read_U8(REGB.BL)
    cpu.write_U8(get_address(cpu, M, AM_MODE_BYTE), value)
    cpu.status.flags = (cpu.status.flags & table_logic_byte.mask) | table_logic_byte.flags[value]
}


/**
 * Add word of two explicit registers (left plus right stored in left)
 */
function op_ADD(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("ADD %s, %s", REG[sr], REG[dr])
    const dvalue = cpu.register_read_U16(dr)
    const svalue = cpu.register_read_U16(sr)
    const result = svalue + dvalue
    cpu.register_write_U16(dr, result)
    cpu.status.flags = table_logic_word.flags[result & 0xFFFF] |
        +((result & 0x10000) != 0) << FLAG_LINK_BIT


    // if (result & 0x8000) {
    //     if (!((svalue | dvalue) & 0x8000))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x8000)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     cpu.status.flags |= FLAG_LINK
}


/**
 * Subtract word of two explicit registers (left minus right stored in left)
 */
function op_SUB(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("SUB %s, %s", REG[sr], REG[dr])
    const dvalue = cpu.register_read_I16(dr)
    const svalue = cpu.register_read_I16(sr)
    const result = svalue - dvalue
    cpu.register_write_I16(dr, result);
    cpu.status.flags = table_logic_word.flags[result & 0xFFFF] |
        +(svalue < 0 !== (dvalue < 0 && result < 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (svalue < 0) {
    //     if (! (dvalue < 0 && result < 0))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (dvalue < 0 && result < 0)
    //         cpu.status.flags |= FLAG_FAULT
    // }
    // cpu.status.flags |= +((dvalue & 0xFFFFF) <= (svalue & 0xFFFFF)) << FLAG_LINK_BIT

    /*

    if svalue is negative
        if not dvalue or result is negative
            set fault
    if svalue is positive or zero
        if both dvalue and result are negative
            set fault

    */
}


/**
 * AND word of two explicit registers (left AND right stored in left)
 */
function op_AND(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("AND %s, %s", REG[sr], REG[dr])
    const value = cpu.register_read_U16(sr) & cpu.register_read_U16(dr)
    cpu.register_write_U16(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * OR word of two explicit registers (left OR right stored in left)
 */
function op_ORI(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("ORI %s, %s", REG[sr], REG[dr])
    const value = cpu.register_read_U16(sr) | cpu.register_read_U16(dr)
    cpu.register_write_U16(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * XOR word of two explicit registers (left XOR right stored in left)
 */
function op_ORE(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("ORE %s, %s", REG[sr], REG[dr])
    const value = cpu.register_read_U16(sr) ^ cpu.register_read_U16(dr)
    cpu.register_write_U16(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Copy word of one explicit register into other explicit register (right into left)
 */
function op_XFR(cpu: CPU6Card, M: number) {
    const [sr, dr] = fetchRegisters(cpu)
    if (DEBUG) DEBUG_captureInstr("XFR %s, %s", REG[sr], REG[dr])
    const value = cpu.register_read_U16(sr)
    cpu.register_write_U16(dr, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Add word of implicit A and B (A plus B stored in B)
 */
function op_AAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("AAB")
    const dvalue = cpu.register_read_U16(REG.B)
    const svalue = cpu.register_read_U16(REG.A)
    const result = svalue + dvalue
    cpu.register_write_U16(REG.B, result);
    cpu.status.flags = table_logic_word.flags[result & 0xFFFF] |
        +((result & 0x10000) != 0) << FLAG_LINK_BIT

    // if (result & 0x8000) {
    //     if (!((svalue | dvalue) & 0x8000))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (svalue & dvalue & 0x8000)
    //         cpu.status.flags |= FLAG_FAULT
    // }
	// if (result & 0x10000)
    //     cpu.status.flags |= FLAG_LINK
}


/**
 * Subtract word of implicit A and B (A minus B stored in B)
 */
function op_SAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("SAB")
    const dvalue = cpu.register_read_I16(REG.B)
    const svalue = cpu.register_read_I16(REG.A)
    const result = svalue - dvalue
    cpu.register_write_I16(REG.B, result);
    cpu.status.flags = table_logic_word.flags[result & 0xFFFF] |
        +(svalue < 0 !== (dvalue < 0 && result <= 0)) << FLAG_FAULT_BIT |
        +((dvalue & 0xFFFF) <= (svalue & 0xFFFF)) << FLAG_LINK_BIT

    // if (value2 & 0x8000) {
    //     if (!((value | result) & 0x8000))
    //         cpu.status.flags |= FLAG_FAULT
    // } else {
    //     if (value & result & 0x8000)
    //         cpu.status.flags |= FLAG_FAULT
    // }
    //cpu.status.flags |= +((value & 0xFFFFF) <= (value2 & 0xFFFFF)) << FLAG_LINK_BIT
}


/**
 * AND word of implicit A and B (A AND B stored in B)
 */
function op_NAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("NAB")
    const A_value = cpu.register_read_U16(REG.A)
    const B_value = cpu.register_read_U16(REG.B)
    const value = A_value & B_value
    cpu.register_write_U16(REG.B, value);
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into X
 */
function op_XAX(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAX")
    const value = cpu.register_read_U16(REG.A)
    cpu.register_write_U16(REG.X, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into Y
 */
function op_XAY(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAY")
    const value = cpu.register_read_U16(REG.A)
    cpu.register_write_U16(REG.Y, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into B
 */
function op_XAB(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAB")
    const value = cpu.register_read_U16(REG.A)
    cpu.register_write_U16(REG.B, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into Z
 */
function op_XAZ(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAZ")
    const value = cpu.register_read_U16(REG.A)
    cpu.register_write_U16(REG.Z, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}


/**
 * Transfer word of implicit A into S
 */
function op_XAS(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstr("XAS")
    const value = cpu.register_read_U16(REG.A)
    cpu.register_write_U16(REG.S, value)
    cpu.status.flags = (cpu.status.flags & table_logic_word.mask) | table_logic_word.flags[value]
}

/**
 * Jump
 */
function op_JMP(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "JMP", M & 0x7, AM_MODE_WORD)
    cpu.status.pc = get_address(cpu, M, AM_MODE_WORD)
}

/**
 * Jump to Subroutine
 */
function op_JSR(cpu: CPU6Card, M: number) {
    if (DEBUG) DEBUG_captureInstrWithAM(cpu, "JSR", M & 0x7, AM_MODE_WORD)
    const addr = get_address(cpu, M & 0x7, AM_MODE_WORD)
    if (M > 7) {
        cpu.stack_push_U16(cpu.register_read_U16(REG.X))
        cpu.register_write_U16(REG.X, cpu.status.pc)
        cpu.register_write_U16(REG.P, cpu.status.pc)
    }
    cpu.status.pc = addr
}
