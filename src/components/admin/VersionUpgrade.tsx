import {
  Button,
  Callout,
  Dialog,
  Flex,
  Text,
  Spinner,
} from "@radix-ui/themes";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, Download, RefreshCw, AlertTriangle } from "lucide-react";

interface VersionInfo {
  current_version: string;
  latest_version: string;
  download_url: string;
  release_notes?: string;
  need_upgrade: boolean;
  checked_at: string;
}

interface UpgradeResult {
  success: boolean;
  message: string;
  new_version?: string;
  backup_path?: string;
}

export default function VersionUpgrade() {
  const { t } = useTranslation();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "downloading" | "restarting" | "success" | "error">("idle");

  // 检查最新版本
  const checkVersion = async () => {
    setChecking(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/update/version/check", {
        credentials: "include",
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setVersionInfo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "检查版本失败");
    } finally {
      setChecking(false);
    }
  };

  // 执行升级
  const doUpgrade = async () => {
    if (!versionInfo?.download_url || !versionInfo?.latest_version) return;

    setUpgradeStatus("downloading");
    try {
      // 调用升级 API
      const resp = await fetch("/api/admin/update/version/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          download_url: versionInfo.download_url,
          version: versionInfo.latest_version,
        }),
      });

      const result: UpgradeResult = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.message || "升级失败");
      }

      setUpgradeStatus("restarting");

      // 等待服务重启
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 尝试重启服务
      try {
        await fetch("/api/admin/update/version/restart", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // 重启 API 可能失败，但下载已完成
      }

      setUpgradeStatus("success");
      
      // 提示用户刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (e) {
      setUpgradeStatus("error");
      setError(e instanceof Error ? e.message : "升级失败");
    }
  };

  return (
    <Flex direction="column" gap="3">
      <Text weight="bold">{t("admin.version_upgrade", { defaultValue: "版本升级" })}</Text>
      
      <Callout.Root>
        <Callout.Icon>
          <AlertTriangle size={16} />
        </Callout.Icon>
        <Callout.Text size="2">
          {t("admin.version_upgrade_warning", { 
            defaultValue: "升级前请确保已备份重要数据。升级完成后服务将自动重启。" 
          })}
        </Callout.Text>
      </Callout.Root>

      <Flex gap="3" align="center">
        <Button
          variant="soft"
          onClick={() => {
            checkVersion();
            setDialogOpen(true);
          }}
          disabled={checking}
        >
          {checking ? <Spinner /> : <RefreshCw size={16} />}
          <Text ml="2">
            {t("admin.check_version", { defaultValue: "检查更新" })}
          </Text>
        </Button>
      </Flex>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Content maxWidth="500px">
          <Dialog.Title>
            {t("admin.version_upgrade", { defaultValue: "版本升级" })}
          </Dialog.Title>

          <Flex direction="column" gap="3" py="3">
            {error && (
              <Callout.Root color="red">
                <Callout.Icon>
                  <AlertTriangle size={16} />
                </Callout.Icon>
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}

            {!versionInfo && !checking && (
              <Text color="gray">{t("admin.click_check_version", { defaultValue: "点击上方按钮检查最新版本" })}</Text>
            )}

            {checking && (
              <Flex align="center" gap="2">
                <Spinner />
                <Text>{t("admin.checking", { defaultValue: "正在检查..." })}</Text>
              </Flex>
            )}

            {versionInfo && (
              <>
                <Flex direction="column" gap="2">
                  <Flex justify="between">
                    <Text color="gray">{t("admin.current_version", { defaultValue: "当前版本" })}:</Text>
                    <Text weight="bold">{versionInfo.current_version}</Text>
                  </Flex>
                  <Flex justify="between">
                    <Text color="gray">{t("admin.latest_version", { defaultValue: "最新版本" })}:</Text>
                    <Text weight="bold" color={versionInfo.need_upgrade ? "green" : undefined}>
                      {versionInfo.latest_version}
                    </Text>
                  </Flex>
                </Flex>

                {versionInfo.release_notes && (
                  <Flex direction="column" gap="1">
                    <Text color="gray" size="2">
                      {t("admin.release_notes", { defaultValue: "更新日志" })}:
                    </Text>
                    <Text 
                      size="2" 
                      className="whitespace-pre-wrap" 
                      style={{ maxHeight: "200px", overflowY: "auto" }}
                    >
                      {versionInfo.release_notes}
                    </Text>
                  </Flex>
                )}

                {upgradeStatus === "idle" && (
                  <Flex gap="2" justify="end" mt="2">
                    <Dialog.Close>
                      <Button variant="soft">{t("common.cancel", { defaultValue: "取消" })}</Button>
                    </Dialog.Close>
                    {versionInfo.need_upgrade ? (
                      <Button color="green" onClick={doUpgrade}>
                        <Download size={16} />
                        <Text ml="2">{t("admin.upgrade_now", { defaultValue: "立即升级" })}</Text>
                      </Button>
                    ) : (
                      <Button disabled>
                        <CheckCircle size={16} />
                        <Text ml="2">{t("admin.already_latest", { defaultValue: "已是最新版本" })}</Text>
                      </Button>
                    )}
                  </Flex>
                )}

                {upgradeStatus === "downloading" && (
                  <Flex align="center" gap="2" justify="center" py="3">
                    <Spinner />
                    <Text>{t("admin.downloading", { defaultValue: "正在下载新版本..." })}</Text>
                  </Flex>
                )}

                {upgradeStatus === "restarting" && (
                  <Flex align="center" gap="2" justify="center" py="3">
                    <Spinner />
                    <Text>{t("admin.restarting", { defaultValue: "正在重启服务..." })}</Text>
                  </Flex>
                )}

                {upgradeStatus === "success" && (
                  <Callout.Root color="green">
                    <Callout.Icon>
                      <CheckCircle size={16} />
                    </Callout.Icon>
                    <Callout.Text>
                      {t("admin.upgrade_success", { defaultValue: "升级成功！页面将在3秒后刷新..." })}
                    </Callout.Text>
                  </Callout.Root>
                )}

                {upgradeStatus === "error" && (
                  <Flex gap="2" justify="end" mt="2">
                    <Button 
                      variant="soft" 
                      onClick={() => {
                        setUpgradeStatus("idle");
                        setError(null);
                      }}
                    >
                      <RefreshCw size={16} />
                      <Text ml="2">{t("common.retry", { defaultValue: "重试" })}</Text>
                    </Button>
                  </Flex>
                )}
              </>
            )}
          </Flex>

          <Flex justify="end" mt="3">
            <Dialog.Close>
              <Button variant="soft">{t("common.close", { defaultValue: "关闭" })}</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}
