param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [Parameter(Mandatory = $true)]
  [string]$IconPath
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

public static class WindowsExeIcon {
    private const int RT_ICON = 3;
    private const int RT_GROUP_ICON = 14;
    private const ushort LANG_NEUTRAL = 0;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr BeginUpdateResource(string fileName, bool deleteExistingResources);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateResource(
        IntPtr updateHandle,
        IntPtr type,
        IntPtr name,
        ushort language,
        byte[] data,
        uint dataSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool EndUpdateResource(IntPtr updateHandle, bool discard);

    private static IntPtr ResourceId(int id) {
        return new IntPtr(id);
    }

    private static ushort U16(byte[] data, int offset) {
        return BitConverter.ToUInt16(data, offset);
    }

    private static uint U32(byte[] data, int offset) {
        return BitConverter.ToUInt32(data, offset);
    }

    private static void PutU16(List<byte> output, ushort value) {
        output.AddRange(BitConverter.GetBytes(value));
    }

    private static void PutU32(List<byte> output, uint value) {
        output.AddRange(BitConverter.GetBytes(value));
    }

    private static void FailLastWin32Error(string operation) {
        throw new InvalidOperationException(operation + " 失败，Win32 错误码：" + Marshal.GetLastWin32Error());
    }

    public static void Apply(string exePath, string iconPath) {
        byte[] iconFile = File.ReadAllBytes(iconPath);
        if (iconFile.Length < 6 || U16(iconFile, 0) != 0 || U16(iconFile, 2) != 1) {
            throw new InvalidDataException("Invalid ICO format.");
        }

        int imageCount = U16(iconFile, 4);
        if (imageCount < 1 || iconFile.Length < 6 + imageCount * 16) {
            throw new InvalidDataException("ICO contains no valid images.");
        }

        var group = new List<byte>(6 + imageCount * 14);
        group.AddRange(new byte[] { 0, 0, 1, 0 });
        PutU16(group, (ushort)imageCount);

        var images = new List<byte[]>(imageCount);
        for (int index = 0; index < imageCount; index++) {
            int entry = 6 + index * 16;
            uint imageSize = U32(iconFile, entry + 8);
            uint imageOffset = U32(iconFile, entry + 12);
            if (imageSize == 0 || imageOffset > iconFile.Length || imageSize > iconFile.Length - imageOffset) {
                throw new InvalidDataException("ICO image data is out of bounds.");
            }

            var image = new byte[imageSize];
            Buffer.BlockCopy(iconFile, (int)imageOffset, image, 0, (int)imageSize);
            images.Add(image);

            for (int field = 0; field < 4; field++) group.Add(iconFile[entry + field]);
            PutU16(group, U16(iconFile, entry + 4));
            PutU16(group, U16(iconFile, entry + 6));
            PutU32(group, imageSize);
            PutU16(group, (ushort)(index + 1));
        }

        IntPtr handle = BeginUpdateResource(exePath, false);
        if (handle == IntPtr.Zero) FailLastWin32Error("Open EXE resources");

        bool committed = false;
        try {
            for (int index = 0; index < images.Count; index++) {
                byte[] image = images[index];
                if (!UpdateResource(handle, ResourceId(RT_ICON), ResourceId(index + 1), LANG_NEUTRAL, image, (uint)image.Length)) {
                    FailLastWin32Error("Write EXE icon");
                }
            }

            byte[] groupBytes = group.ToArray();
            if (!UpdateResource(handle, ResourceId(RT_GROUP_ICON), ResourceId(1), LANG_NEUTRAL, groupBytes, (uint)groupBytes.Length)) {
                FailLastWin32Error("Write EXE icon group");
            }
            if (!EndUpdateResource(handle, false)) FailLastWin32Error("Save EXE icon");
            committed = true;
        } finally {
            if (!committed) EndUpdateResource(handle, true);
        }
    }
}
'@

[WindowsExeIcon]::Apply((Resolve-Path -LiteralPath $ExePath).Path, (Resolve-Path -LiteralPath $IconPath).Path)
