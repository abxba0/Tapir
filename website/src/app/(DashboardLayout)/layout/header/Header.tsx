import React from "react";
import {
  Box,
  AppBar,
  Toolbar,
  styled,
  Stack,
  IconButton,
  Button,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { IconMenu, IconBrandGithub } from "@tabler/icons-react";

interface ItemType {
  toggleMobileSidebar: (event: React.MouseEvent<HTMLElement>) => void;
}

const Header = ({ toggleMobileSidebar }: ItemType) => {
  const AppBarStyled = styled(AppBar)(({ theme }) => ({
    boxShadow: "none",
    background: theme.palette.background.paper,
    justifyContent: "center",
    backdropFilter: "blur(4px)",
    [theme.breakpoints.up("lg")]: {
      minHeight: "70px",
    },
  }));

  const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
    width: "100%",
    color: theme.palette.text.secondary,
  }));

  return (
    <AppBarStyled position="sticky" color="default">
      <ToolbarStyled>
        <IconButton
          color="inherit"
          aria-label="menu"
          onClick={toggleMobileSidebar}
          sx={{
            display: {
              lg: "none",
              xs: "inline",
            },
          }}
        >
          <IconMenu width="20" height="20" />
        </IconButton>

        <Typography
          variant="subtitle2"
          color="textSecondary"
          sx={{ display: { xs: "none", sm: "block" } }}
        >
          Media Downloader · Converter · Transcriber · TTS
        </Typography>

        <Box flexGrow={1} />

        <Stack spacing={1} direction="row" alignItems="center">
          <Button
            variant="outlined"
            component={Link}
            href="https://github.com/abxba0/Tapir"
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<IconBrandGithub size={18} />}
            color="primary"
            size="small"
          >
            GitHub
          </Button>
          <Button
            variant="contained"
            component={Link}
            href="/getting-started"
            disableElevation
            color="primary"
          >
            Get Started
          </Button>
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  );
};

export default Header;
