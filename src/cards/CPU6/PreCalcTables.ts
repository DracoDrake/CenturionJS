
/**
 * PreCalcTables.ts
 * 
 * This file is part of CenturionJS, a Javascript Emulator of a Centurion Minicomputer
 * Copyright (c) 2022 Mike Cole
 * License: GPL-2.0
 * 
 */

const FLAG_LINK = 1
const FLAG_MINUS = 2
const FLAG_FAULT = 4
const FLAG_VALUE = 8

interface PreCalcTableSingle {
    data: number[]
    flags: number[]
    mask: number
}

interface PreCalcTableDouble {
    data: number[][]
    flags: number[][]
    mask: number
}

interface PreCalcTableTriple {
    data: number[][][]
    flags: number[][][]
    mask: number
}

function makeTableLogicByte() {
    let i
    const table: PreCalcTableSingle = {
        data: [],
        flags: [],
        mask: ~(FLAG_MINUS | FLAG_VALUE) & 0xFF
    }

    let flags

    for (i = 0; i < 0x100; i++) {
        flags = 0
        if (i > 0x7F)
            flags |= FLAG_MINUS
        if (i == 0)
            flags |= FLAG_VALUE

        table.flags.push(flags)
    }

    return table
}

function makeTableLogicWord() {
    let i
    const table: PreCalcTableSingle = {
        data: [],
        flags: [],
        mask: ~(FLAG_MINUS | FLAG_VALUE) & 0xFF
    }

    let flags

    for (i = 0; i < 0x10000; i++) {
        flags = 0
        if (i > 0x7FFF)
            flags |= FLAG_MINUS
        if (i == 0)
            flags |= FLAG_VALUE

        table.flags.push(flags)
    }

    return table
}

function makeTableMath() {
    let i
    const table: PreCalcTableSingle = {
        data: [],
        flags: [],
        mask: ~(FLAG_MINUS | FLAG_VALUE | FLAG_FAULT) & 0xFF
    }

    return table
}

function makeTableSRByte() {
    let i, val
    const table: PreCalcTableDouble = {
        data: [],
        flags: [],
        mask: ~(FLAG_LINK | FLAG_MINUS | FLAG_VALUE) & 0xFF
    }

    for (i = 0; i < 0x100; i++) {
        table.data[i] = []
        table.flags[i] = []
        for (val = 1; val <= 16; val++) {
            let v, r

            r = ((i << 24) >> 24) >> val - 1
            v = r >> 1

            let flags = 0
            if (v < 0)
                flags |= FLAG_MINUS
            if (v == 0)
                flags |= FLAG_VALUE
            if (r & 1)
                flags |= FLAG_LINK

            table.data[i][val-1] = v & 0xFF
            table.flags[i][val-1] = flags
        }
    }

    return table
}

function makeTableSLByte() {
    let i, j, val, pos
    const table: PreCalcTableDouble = {
        data: [],
        flags: [],
        mask: ~(FLAG_LINK | FLAG_MINUS | FLAG_VALUE | FLAG_FAULT) & 0xFF
    }

    for (i = 0; i < 0x100; i++) {
        table.data[i] = []
        table.flags[i] = []
        for (val = 1; val <= 16; val++) {
            let v, r

            r = (i << val - 1) & 0xFF
            v = (r << 1) & 0xFF

            let flags = 0
            if (v > 0x7F)
                flags |= FLAG_MINUS
            if (v == 0)
                flags |= FLAG_VALUE
            if (r > 0x7F)
                flags |= FLAG_LINK
            if (v > 0x7F !== r > 0x7F)
                flags |= FLAG_FAULT

            table.data[i][val-1] = v
            table.flags[i][val-1] = flags
        }
    }

    return table
}

function makeTableRRByte() {
    let i, L, val
    const table: PreCalcTableTriple = {
        data: [],
        flags: [],
        mask: ~(FLAG_LINK | FLAG_MINUS | FLAG_VALUE) & 0xFF
    }

    for (i = 0; i < 0x100; i++) {
        table.data[i] = []
        table.flags[i] = []
        for (val = 1; val <= 16; val++) {
            table.data[i][val-1] = []
            table.flags[i][val-1] = []
            for (L = 0; L < 2; L++) {
                let v, r, count

                r = i | (L << 8)
                count = val % 9
                v = ((r >> count) | (r << (9 - count))) & 0x1FF

                let flags = 0
                if (v & 0x80)
                    flags |= FLAG_MINUS
                if ((v & 0xff) == 0)
                    flags |= FLAG_VALUE
                if (v & 0x100)
                    flags |= FLAG_LINK

                table.data[i][val-1][L] = v & 0xFF
                table.flags[i][val-1][L] = flags
            }
        }
    }

    return table
}

function makeTableRLByte() {
    let i, L, val
    const table: PreCalcTableTriple = {
        data: [],
        flags: [],
        mask: ~(FLAG_LINK | FLAG_MINUS | FLAG_VALUE) & 0xFF
    }

    for (i = 0; i < 0x100; i++) {
        table.data[i] = []
        table.flags[i] = []
        for (val = 1; val <= 16; val++) {
            table.data[i][val-1] = []
            table.flags[i][val-1] = []
            for (L = 0; L < 2; L++) {
                let v, r, count

                r = i | (L << 8)
                count = val % 9
                v = ((r << count) | (r >> (9 - count))) & 0x1FF

                let flags = 0
                if (v & 0x80)
                    flags |= FLAG_MINUS
                if ((v & 0xff) == 0)
                    flags |= FLAG_VALUE
                if (v & 0x100)
                    flags |= FLAG_LINK
                if (((v >> 1) ^ v) & 0x80)
                    flags |= FLAG_FAULT

                table.data[i][val-1][L] = v & 0xFF
                table.flags[i][val-1][L] = flags
            }
        }
    }

    return table
}

function makeBranchTable() {
    const bin = "AAD//wAA//8AAP//AAD/////AACqqszM8PAA/wAAAAD//wAAAAD//wAA//8AAP////8AAKqqzMzw8AD/AAAAAAAA//8AAP//AAD/////AAAAAP//qqrMzPDwAP8AAAAA//8AAAAA//8AAP////8AAAAA//+qqszM8PAA/wAAAAAAAP////8AAAAA//8AAP////8AAKqqzMzw8AD/AAAAAP//AAD//wAAAAD//wAA/////wAAqqrMzPDwAP8AAAAAAAD/////AAAAAP////8AAAAA//+qqszM8PAA/wAAAAD//wAA//8AAAAA/////wAAAAD//6qqzMzw8AD/AAAAAAAA//8AAP////8AAAAA//8AAP//qqrMzPDwAP8AAAAA//8AAAAA/////wAAAAD//wAA//+qqszM8PAA/wAAAAAAAP//AAD/////AAD//wAAAAD//6qqzMzw8AD/AAAAAP//AAAAAP////8AAP//AAAAAP//qqrMzPDwAP8AAAAAAAD/////AAD//wAAAAD//wAA//+qqszM8PAA/wAAAAD//wAA//8AAP//AAAAAP//AAD//6qqzMzw8AD/AAAAAAAA/////wAA//8AAP//AAAAAP//qqrMzPDwAP8AAAAA//8AAP//AAD//wAA//8AAAAA//+qqszM8PAA/wAAAAA="
    let buf = Buffer.from(bin, 'base64')

    let table = []
    
    for(let j = 0; j < 512; j++) {
        let byte = 0
        for(let i = 0 ; i < 8; i++) {
            table[j*8 + i] = (buf[j] >> i) & 1
        }
    }

    return table
}

export let table_logic_byte: PreCalcTableSingle
export let table_logic_word: PreCalcTableSingle
export let table_math_mask = ~(FLAG_MINUS | FLAG_VALUE | FLAG_FAULT) & 0xFF

export let table_SR_byte: PreCalcTableDouble
export let table_SL_byte: PreCalcTableDouble
export let table_RR_byte: PreCalcTableTriple
export let table_RL_byte: PreCalcTableTriple

export let table_branch: number[]

export function makeTables() {
    table_logic_byte = makeTableLogicByte()
    table_logic_word = makeTableLogicWord()

    table_SR_byte = makeTableSRByte()
    table_SL_byte = makeTableSLByte()
    table_RR_byte = makeTableRRByte()
    table_RL_byte = makeTableRLByte()

    table_branch = makeBranchTable()
}
